<?php

namespace App\Http\Controllers;

use App\Mail\AdminAccessCodeMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Вход в панель модерации по коду из почты.
 *
 * Даже залогиненный админ видит содержимое только после кода:
 * вводит свою почту — туда прилетает 6 цифр — вводит их.
 * Код живёт CODE_TTL_SECONDS секунд, неверных попыток —
 * не больше CODE_MAX_ATTEMPTS, повторная отправка —
 * не чаще CODE_RESEND_SECONDS секунд. Разблокировка
 * живёт в сессии UNLOCK_TTL_MINUTES минут.
 */
class AdminAccessController extends Controller
{
    /** Сколько минут действует разблокировка панели. */
    public const UNLOCK_TTL_MINUTES = 60;

    /** Ключ метки разблокировки в сессии. */
    public const SESSION_KEY = 'admin_unlocked_at';

    /** Время жизни кода, секунд. */
    public const CODE_TTL_SECONDS = 600;

    /** Пауза между отправками кода, секунд. */
    public const CODE_RESEND_SECONDS = 60;

    /** Неверных попыток ввода до аннуляции кода. */
    public const CODE_MAX_ATTEMPTS = 5;

    /**
     * Статус гейта: почта, отправлен ли код, открыта ли панель.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function status(Request $request)
    {
        $payload = $this->codePayload($request->user()->id);

        return response()->json([
            'email' => $request->user()->email,
            'code_sent' => $payload !== null,
            'code_expires_in' => $payload ? max(0, $payload['expires_at'] - now()->timestamp) : 0,
            'unlocked' => $this->isUnlocked($request),
        ]);
    }

    /**
     * Отправить код на почту текущего админа.
     *
     * Принимаем только его собственную почту: чужую не обслуживаем,
     * чтобы коды не утекали посторонним.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function code(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
        ]);

        $me = $request->user();
        $email = mb_strtolower(trim($data['email']));

        if ($email !== mb_strtolower(trim((string) $me->email))) {
            return response()->json(['message' => 'Код отправляем только на почту этого аккаунта.'], 422);
        }

        if (Cache::has($this->cooldownKey($me->id))) {
            return response()->json(['message' => 'Код уже отправлен — подожди минуту перед повтором.'], 429);
        }

        $code = (string) random_int(100000, 999999);

        Cache::put($this->codeKey($me->id), [
            'hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addSeconds(self::CODE_TTL_SECONDS)->timestamp,
        ], self::CODE_TTL_SECONDS);

        try {
            $mailer = (string) config('mail.default', 'log');

            Log::info('admin access code sending', [
                'mailer' => $mailer,
                'to' => $me->email,
            ]);

            Mail::to($me->email)->send(new AdminAccessCodeMail($code, (int) (self::CODE_TTL_SECONDS / 60)));
        } catch (\Throwable $e) {
            Cache::forget($this->codeKey($me->id));

            $mailer = (string) config('mail.default', 'unknown');

            Log::warning('admin access code mail failed', [
                'mailer' => $mailer,
                'to' => $me->email,
                'exception' => get_class($e),
                'error' => $e->getMessage(),
            ]);

            report($e);

            $isSmtp = $mailer === 'smtp';
            $hint = $isSmtp
                ? 'На хостинге (Laravel Cloud) исходящий SMTP обычно заблокирован — переключи MAIL_MAILER на API-драйвер (resend) и нажми «Отправить заново».'
                : 'Почтовый сервис временно недоступен — подожди минуту и нажми «Отправить заново».';

            return response()->json([
                'message' => "Не удалось отправить код: {$hint}",
                'retryable' => true,
            ], 500);
        }

        Cache::put($this->cooldownKey($me->id), true, self::CODE_RESEND_SECONDS);

        return response()->json(['sent' => true, 'expires_in' => self::CODE_TTL_SECONDS]);
    }

    /**
     * Проверить код и открыть панель.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function verify(Request $request)
    {
        $data = $request->validate([
            'email' => 'required|email|max:255',
            'code' => 'required|digits:6',
        ]);

        $me = $request->user();

        if (mb_strtolower(trim($data['email'])) !== mb_strtolower(trim((string) $me->email))) {
            return response()->json(['message' => 'Код отправляем только на почту этого аккаунта.'], 422);
        }

        $payload = $this->codePayload($me->id);

        if ($payload === null) {
            return response()->json(['message' => 'Код истёк — запроси новый.'], 422);
        }

        if (($payload['attempts'] ?? 0) >= self::CODE_MAX_ATTEMPTS) {
            Cache::forget($this->codeKey($me->id));

            return response()->json(['message' => 'Слишком много неверных попыток — запроси новый код.'], 422);
        }

        if (! Hash::check($data['code'], (string) ($payload['hash'] ?? ''))) {
            $payload['attempts'] = ($payload['attempts'] ?? 0) + 1;
            $ttl = max(1, $payload['expires_at'] - now()->timestamp);
            Cache::put($this->codeKey($me->id), $payload, $ttl);
            $left = self::CODE_MAX_ATTEMPTS - $payload['attempts'];

            return response()->json(['message' => "Неверный код. Осталось попыток: {$left}."], 422);
        }

        Cache::forget($this->codeKey($me->id));
        Cache::forget($this->cooldownKey($me->id));
        $request->session()->put(self::SESSION_KEY, now()->timestamp);

        return response()->json(['unlocked' => true]);
    }

    /**
     * Закрыть панель до следующего кода.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function lock(Request $request)
    {
        $request->session()->forget(self::SESSION_KEY);

        return response()->json(['unlocked' => false]);
    }

    /**
     * Активна ли разблокировка в текущей сессии.
     *
     * @param Request $request
     * @return bool
     */
    private function isUnlocked(Request $request): bool
    {
        $at = (int) $request->session()->get(self::SESSION_KEY, 0);

        if ($at <= 0) {
            return false;
        }

        return now()->timestamp - $at < self::UNLOCK_TTL_MINUTES * 60;
    }

    /**
     * Прочитать payload кода из кэша.
     *
     * @param int $userId
     * @return array{hash:string,attempts:int,expires_at:int}|null
     */
    private function codePayload(int $userId): ?array
    {
        $payload = Cache::get($this->codeKey($userId));

        if (! is_array($payload) || empty($payload['hash'])) {
            return null;
        }

        if (($payload['expires_at'] ?? 0) <= now()->timestamp) {
            Cache::forget($this->codeKey($userId));

            return null;
        }

        return $payload;
    }

    /**
     * Ключ кэша кода.
     *
     * @param int $userId
     * @return string
     */
    private function codeKey(int $userId): string
    {
        return "admin_access_code:{$userId}";
    }

    /**
     * Ключ кэша паузы между отправками.
     *
     * @param int $userId
     * @return string
     */
    private function cooldownKey(int $userId): string
    {
        return "admin_access_code_cooldown:{$userId}";
    }
}
