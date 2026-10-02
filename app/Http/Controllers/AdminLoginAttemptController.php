<?php

namespace App\Http\Controllers;

use App\Models\LoginAttempt;
use Illuminate\Http\Request;

/**
 * Логи входов для таба «Безопасность»: кто ломится, откуда, чем.
 */
class AdminLoginAttemptController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:100',
            'successful' => 'nullable|in:all,failed,success',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);
        $q = trim($data['q'] ?? '');
        $mode = $data['successful'] ?? 'failed';
        $query = LoginAttempt::with('user:id,name,email')->latest('id');
        if ($mode === 'failed') $query->where('successful', false);
        elseif ($mode === 'success') $query->where('successful', true);
        if (strlen($q) >= 1) {
            $query->where(fn ($w) => $w->where('email', 'like', "%$q%")->orWhere('ip', 'like', "%$q%")->orWhere('country', 'like', "%$q%"));
        }
        $list = $query->paginate((int) ($data['per_page'] ?? 20));
        $aggregates = $this->aggregates($list->getCollection());
        $rows = $list->getCollection();
        $statusMap = \App\Services\LoginShield::statusMap($rows->map(fn ($a) => (string) $a->email)->all());
        $list->getCollection()->transform(function ($a) use ($aggregates, $statusMap) {
            $emailKey = \App\Services\LoginShield::normalizeEmail((string) $a->email);
            $emailStatus = $statusMap[$emailKey] ?? ['count' => 0, 'frozen_until' => null, 'is_frozen' => false, 'retry_mins' => 0];
            $isBanned = $a->user && $a->user->banned_at !== null;
            $isFrozen = (bool) ($emailStatus['is_frozen'] ?? false);
            $fails = (int) ($emailStatus['count'] ?? 0);
            $state = 'ok';
            if ($isBanned && $isFrozen) {
                $state = 'banned_frozen';
            } elseif ($isBanned) {
                $state = 'banned';
            } elseif ($isFrozen) {
                $state = 'frozen';
            } elseif ($fails > 0) {
                $state = 'warning';
            }

            return [
                'id' => $a->id,
                'email' => $a->email,
                'user' => $a->user ? ['id' => $a->user->id, 'name' => $a->user->name, 'email' => $a->user->email, 'banned_at' => $a->user->banned_at?->toISOString(), 'banned_reason' => $a->user->banned_reason] : null,
                'ip' => $a->ip,
                'country' => $a->country,
                'country_code' => $a->country_code,
                'city' => $a->city,
                'user_agent' => $a->user_agent,
                'successful' => (bool) $a->successful,
                'created_at' => $a->created_at?->toISOString(),
                'ip_fails_24h' => (int) ($aggregates['ipFails'][$a->ip] ?? 0),
                'ip_emails_24h' => (int) ($aggregates['ipEmails'][$a->ip] ?? 0),
                'email_fails_24h' => (int) ($aggregates['emailFails'][$a->email] ?? 0),
                'fails_consecutive' => $fails,
                'is_frozen' => $isFrozen,
                'frozen_until' => $emailStatus['frozen_until'] ?? null,
                'retry_mins' => (int) ($emailStatus['retry_mins'] ?? 0),
                'is_banned' => (bool) $isBanned,
                'login_state' => $state,
            ];
        });
        $failedToday = LoginAttempt::where('successful', false)->where('created_at', '>=', now()->subDay())->count();
        $bannedTotal = \App\Models\User::whereNotNull('banned_at')->count();
        return response()->json(array_merge($list->toArray(), ['stats' => [
            'failed_today' => $failedToday,
            'failed_unseen' => $this->unseenCount($request->user(), $failedToday),
            'banned_total' => $bannedTotal,
        ]]));
    }

    /**
     * Пометить попытки входа прочитанными: бейдж таба гаснет.
     *
     * Водяной знак хранится в settings текущего админа, у каждого
     * свой. Новые фейлы после метки снова зажгут счётчик.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function seen(Request $request)
    {
        $me = $request->user();
        $settings = $me->settings ?? [];
        $settings['login_attempts_seen_at'] = now()->toISOString();
        $me->forceFill(['settings' => $settings])->saveQuietly();

        $failedToday = LoginAttempt::where('successful', false)->where('created_at', '>=', now()->subDay())->count();
        $bannedTotal = \App\Models\User::whereNotNull('banned_at')->count();

        return response()->json(['stats' => [
            'failed_today' => $failedToday,
            'failed_unseen' => 0,
            'banned_total' => $bannedTotal,
        ]]);
    }

    /**
     * Сбросить заморозку и счётчик фейлов по email без разбана.
     *
     * Нужен для «замороженных, но не забаненных» (3 фейла): у них нет
     * banned_at, разбанивать нечего, а вход всё ещё закрыт на час.
     * Рвём цепочку success-маркером и чистим RateLimiter — история сохраняется.
     *
     * @param Request $request запрос с полем email
     * @return \Illuminate\Http\JsonResponse
     */
    public function reset(Request $request)
    {
        $data = $request->validate(['email' => 'required|string|max:191']);

        $email = \App\Services\LoginShield::normalizeEmail($data['email']);
        $user = \App\Models\User::where('email', $email)->first();

        \App\Services\LoginShield::thaw($email, $user?->id, 'admin:reset — ручной сброс заморозки и счётчика фейлов');

        $status = \App\Services\LoginShield::status($email);

        return response()->json([
            'ok' => true,
            'email' => $email,
            'fails_consecutive' => $status['count'],
            'is_frozen' => $status['is_frozen'],
            'is_banned' => (bool) ($user && $user->banned_at !== null),
        ]);
    }

    /**
     * Агрегаты за 24ч для строк текущей страницы.
     *
     * Три групповых запроса вместо N+1: сколько фейлов с каждого IP,
     * сколько разных email долбит каждый IP (признак перебора),
     * сколько фейлов по каждому email.
     *
     * @param \Illuminate\Support\Collection<int, LoginAttempt> $rows
     * @return array{ipFails:array<string,int>,ipEmails:array<string,int>,emailFails:array<string,int>}
     */
    private function aggregates($rows): array
    {
        $since = now()->subDay();

        $ips = $rows
            ->map(fn ($a) => $a->ip)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $emails = $rows
            ->map(fn ($a) => $a->email)
            ->filter()
            ->unique()
            ->values()
            ->all();

        $ipFails = [];
        $ipEmails = [];
        $emailFails = [];

        if ($ips !== []) {
            $ipFails = LoginAttempt::where('successful', false)
                ->where('created_at', '>=', $since)
                ->whereIn('ip', $ips)
                ->selectRaw('ip, COUNT(*) as c')
                ->groupBy('ip')
                ->pluck('c', 'ip')
                ->map(fn ($c) => (int) $c)
                ->all();

            $ipEmails = LoginAttempt::where('successful', false)
                ->where('created_at', '>=', $since)
                ->whereIn('ip', $ips)
                ->selectRaw('ip, COUNT(DISTINCT email) as c')
                ->groupBy('ip')
                ->pluck('c', 'ip')
                ->map(fn ($c) => (int) $c)
                ->all();
        }

        if ($emails !== []) {
            $emailFails = LoginAttempt::where('successful', false)
                ->where('created_at', '>=', $since)
                ->whereIn('email', $emails)
                ->selectRaw('email, COUNT(*) as c')
                ->groupBy('email')
                ->pluck('c', 'email')
                ->map(fn ($c) => (int) $c)
                ->all();
        }

        return ['ipFails' => $ipFails, 'ipEmails' => $ipEmails, 'emailFails' => $emailFails];
    }

    /**
     * Число непрочитанных фейлов для бейджа таба.
     *
     * Без метки прочтения — весь объём за 24ч, с меткой —
     * только фейлы новее неё.
     *
     * @param \App\Models\User $me текущий админ
     * @param int $failedToday фолбэк, если метки ещё не было
     * @return int
     */
    private function unseenCount($me, int $failedToday): int
    {
        $seenAt = ($me->settings ?? [])['login_attempts_seen_at'] ?? null;

        if (! $seenAt) {
            return $failedToday;
        }

        try {
            $since = \Carbon\Carbon::parse($seenAt);
        } catch (\Throwable) {
            return $failedToday;
        }

        return LoginAttempt::where('successful', false)
            ->where('created_at', '>', $since)
            ->count();
    }
}
