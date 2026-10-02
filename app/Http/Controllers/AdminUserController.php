<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;

class AdminUserController extends Controller
{
    /**
     * Создать тестового пользователя с придуманными логином и паролем.
     *
     * Только полные админы (роут в группе `admin`). Безопасно по построению:
     * роль/тариф/флаги из запроса не читаются вообще — всегда обычная персона
     * (role=user, без is_admin), пароль — через Hash + Password::defaults(),
     * почта — уникальная. Почту сразу помечаем подтверждённой, чтобы тестовый
     * аккаунт работал без доступа к ящику (письма на test-почты не дойдут).
     *
     * @param Request $request запрос с name/email/password/password_confirmation
     * @return \Illuminate\Http\JsonResponse созданный пользователь
     */
    public function store(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403, 'Создание пользователей — только для администраторов');

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:users,email',
            'password' => ['required', 'string', 'confirmed', Rules\Password::defaults()],
            'gender' => 'nullable|in:male,female,other',
        ]);

        $email = mb_strtolower(trim($data['email']));

        $user = User::create([
            'name' => trim($data['name']),
            'email' => $email,
            'password' => Hash::make($data['password']),
            'gender' => $data['gender'] ?? 'other',
            'signup_goal' => 'chat',
            'default_mode' => 'ulove',
            'default_mode_set_at' => now(),
            'enabled_modules' => ['ulove', 'upin'],
            'account_type' => 'person',
            'dating_enabled' => true,
            'role' => 'user',
            'is_admin' => false,
            'email_verified_at' => now(),
        ]);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ], 201);
    }

    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);
        $q = trim($data['q'] ?? '');
        $query = User::query()->orderByDesc('last_seen_at');
        if (strlen($q) >= 1) {
            $query->where(fn ($w) => $w->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%"));
        }
        $threshold = now()->subMinutes(\App\Services\MonitoringService::ONLINE_MINUTES);
        $users = $query->select('id', 'name', 'email', 'avatar_path', 'role', 'is_admin', 'is_hidden_from_search', 'plan', 'plan_expires_at', 'last_seen_at', 'is_invisible', 'created_at', 'banned_at', 'banned_reason', 'account_type')
            ->paginate((int) ($data['per_page'] ?? 20));
        $rows = $users->getCollection();
        $businessMap = [];
        try {
            $businessMap = \App\Models\Business::whereIn('user_id', $rows->pluck('id')->all() ?: [0])
                ->orderByDesc('id')
                ->get()
                ->keyBy('user_id');
        } catch (\Throwable) {
            $businessMap = collect();
        }
        $users->getCollection()->transform(function ($u) use ($threshold, $businessMap) {
            $isBusiness = ($u->account_type ?? 'person') === 'business';
            $businessRow = $isBusiness ? ($businessMap[$u->id] ?? null) : null;
            $business = null;

            if ($isBusiness) {
                $business = $businessRow ? [
                    'legal_form' => (string) ($businessRow->legal_form ?? 'ooo'),
                    'is_organization' => $businessRow->isOrganization(),
                    'is_verified' => $businessRow->isVerified(),
                    'verification_status' => (string) ($businessRow->verification_status ?? 'draft'),
                    'unp' => $businessRow->unp,
                    'name' => (string) ($businessRow->name ?? $u->name ?? ''),
                ] : [
                    'legal_form' => 'ooo',
                    'is_organization' => true,
                    'is_verified' => false,
                    'verification_status' => 'draft',
                    'unp' => null,
                    'name' => (string) ($u->name ?? ''),
                ];
            }

            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'avatar_path' => $u->avatar_path,
                'avatar_url' => $u->avatar_url,
                'role' => $u->role,
                'is_admin' => $u->isAdmin(),
                'is_hidden_from_search' => (bool) $u->is_hidden_from_search,
                'plan' => $u->plan,
                'effective_plan' => $u->effectivePlan(),
                'plan_expires_at' => $u->plan_expires_at?->toISOString(),
                'account_type' => $u->account_type ?? 'person',
                'is_business' => $isBusiness,
                'is_organization' => (bool) ($business['is_organization'] ?? false),
                'business' => $business,
                'is_online' => $u->last_seen_at && $u->last_seen_at->gte($threshold),
                'last_seen_at' => $u->last_seen_at?->toISOString(),
                'is_invisible' => (bool) $u->is_invisible,
                'banned_at' => $u->banned_at?->toISOString(),
                'banned_reason' => $u->banned_reason,
                'created_at' => $u->created_at?->toISOString(),
            ];
        });
        return response()->json($users);
    }

    /**
     * Обновить план/роль пользователя.
     *
     * Только полные админы: модератор не должен выдавать роли
     * (иначе повысит себя до админа) и менять тарифы.
     *
     * Свою роль менять можно, но снятие admin с себя запрещено,
     * если это последний администратор в системе.
     *
     * Выдача pro/premium/business без явной даты ставит срок +30 дней,
     * если текущий срок отсутствует или уже прошёл: иначе тариф
     * выглядел бы выданным, а лимиты считались бы по free
     * (действующий тариф — effectivePlan, не сырое поле plan).
     *
     * Роль organization автоматически выдаёт тариф business (+30 дней,
     * если срок пуст/прошёл): раз зашли в кабинет — значит оплатили.
     * Business — только для организаторов. Стаффу (moderator/admin)
     * выдаётся Premium: effectivePlan всё равно вернёт premium.
     * Персональному аккаунту (person без бизнес-профиля) роль выдаётся
     * только с флагом confirm_personal, иначе 422 с предупреждением.
     *
     * @param Request $request запрос с plan/role
     * @param User $user целевой пользователь
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, User $user)
    {
        abort_unless($request->user()->isAdmin(), 403, 'Смена роли и тарифа — только для администраторов');

        $data = $request->validate([
            'plan' => 'nullable|in:free,pro,premium,business',
            'plan_expires_at' => 'nullable|date|after:now',
            'role' => 'nullable|in:user,moderator,admin,organization',
            'confirm_personal' => 'nullable|boolean',
        ]);
        $isSelf = $user->id === $request->user()->id;
        $demotesSelfFromAdmin = $isSelf
            && isset($data['role'])
            && $request->user()->isAdmin()
            && $data['role'] !== 'admin';
        if ($demotesSelfFromAdmin) {
            $otherAdmins = User::query()
                ->where('id', '!=', $user->id)
                ->where(fn ($w) => $w->where('is_admin', true)->orWhere('role', 'admin'))
                ->count();
            abort_if($otherAdmins === 0, 422, 'Нельзя снять роль последнего администратора');
        }
        $assignOrganization = isset($data['role']) && $data['role'] === 'organization';
        $roleWarning = null;

        if ($assignOrganization) {
            $roleWarning = $this->organizationRoleWarning($user);

            abort_if(
                $roleWarning !== null && empty($data['confirm_personal']),
                422,
                $roleWarning
            );
        }

        if (isset($data['plan'])) {
            $user->plan = $data['plan'];
            $user->plan_expires_at = $this->resolvePlanExpiry($data['plan'], $data['plan_expires_at'] ?? null, $user->plan_expires_at);
        } elseif (isset($data['plan_expires_at'])) {
            $user->plan_expires_at = \Carbon\Carbon::parse($data['plan_expires_at']);
        }
        if (isset($data['role'])) {
            $user->role = $data['role'];
            $user->is_admin = $data['role'] === 'admin';
        }
        if ($assignOrganization && ! isset($data['plan'])) {
            $user->plan = 'business';
            $user->plan_expires_at = $this->resolvePlanExpiry('business', $data['plan_expires_at'] ?? null, $user->plan_expires_at);
        }
        $user->save();
        return response()->json(['id' => $user->id, 'plan' => $user->plan, 'effective_plan' => $user->effectivePlan(), 'plan_expires_at' => $user->plan_expires_at?->toISOString(), 'role' => $user->role, 'is_admin' => $user->isAdmin(), 'account_type' => $user->account_type ?? 'person', 'role_warning' => $roleWarning]);
    }

    /**
     * Предупреждение при выдаче роли organization персональному аккаунту.
     *
     * Организация — это кабинет компании (account_type=business + реквизиты).
     * Персональный аккаунт (person без бизнес-профиля) с предпринимательской
     * деятельностью не связан: выдача ему роли organization без подтверждения
     * блокируется (422), с подтверждением — пропускается, но предупреждение
     * возвращается в ответе для тоста в админке.
     *
     * @param User $user целевой пользователь
     * @return string|null текст предупреждения или null когда всё чисто
     */
    private function organizationRoleWarning(User $user): ?string
    {
        $isBusiness = ($user->account_type ?? 'person') === 'business';

        if ($isBusiness) {
            return null;
        }

        $hasBusiness = false;

        try {
            $hasBusiness = \App\Models\Business::where('user_id', $user->id)->exists();
        } catch (\Throwable) {
            $hasBusiness = false;
        }

        if ($hasBusiness) {
            return null;
        }

        return 'Данный аккаунт персональный и не связан с предпринимательской деятельностью. '
            . 'Роль «организация» предназначена только для кабинета компании '
            . '(account_type=business с реквизитами и тарифом business).';
    }

    /**
     * Посчитать срок действия тарифа при смене плана.
     *
     * Free срок не имеет. Платному без явной даты даём +30 дней,
     * если прежний срок отсутствует или уже прошёл; будущий срок
     * сохраняем, чтобы не урезать уже оплаченное.
     *
     * @param string $plan новый план (free|pro|premium|business)
     * @param string|null $requested явная дата из запроса
     * @param mixed $current текущий срок из базы
     * @return \Carbon\Carbon|null
     */
    private function resolvePlanExpiry(string $plan, ?string $requested, mixed $current): ?\Carbon\Carbon
    {
        if ($plan === 'free') {
            return null;
        }

        if ($requested !== null) {
            return \Carbon\Carbon::parse($requested);
        }

        try {
            $currentExpiry = $current ? \Carbon\Carbon::parse($current) : null;
        } catch (\Throwable) {
            $currentExpiry = null;
        }

        if ($currentExpiry && $currentExpiry->isFuture()) {
            return $currentExpiry;
        }

        return \Carbon\Carbon::now()->addDays(30);
    }

    /**
     * Поиск пользователей для таба «Модерация».
     *
     * Модераторам админов не показываем вообще: по отношению
     * к админу у модератора нет никаких действий — ни скрыть,
     * ни удалить, вообще ничего.
     *
     * @param Request $request запрос с q
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
        $q = trim($request->input('q', ''));
        abort_if(strlen($q) < 2, 422, 'Минимум 2 символа');
        $users = User::where(fn($qq) => $qq->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%"));
        if (! $request->user()->isAdmin()) {
            $users->where('is_admin', false)->where('role', '!=', 'admin');
        }
        $rows = $users->select('id', 'name', 'email', 'avatar_path', 'role', 'is_admin', 'is_hidden_from_search', 'plan', 'plan_expires_at', 'account_type')
            ->limit(20)->get();
        $businessMap = [];
        try {
            $businessMap = \App\Models\Business::whereIn('user_id', $rows->pluck('id')->all() ?: [0])
                ->orderByDesc('id')
                ->get()
                ->keyBy('user_id');
        } catch (\Throwable) {
            $businessMap = collect();
        }
        $mapped = $rows
            ->map(function($u) use ($businessMap) {
                $isBusiness = ($u->account_type ?? 'person') === 'business';
                $businessRow = $isBusiness ? ($businessMap[$u->id] ?? null) : null;

                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'avatar_path' => $u->avatar_path,
                    'avatar_url' => $u->avatar_url,
                    'role' => $u->role,
                    'is_admin' => $u->isAdmin(),
                    'is_hidden_from_search' => (bool) $u->is_hidden_from_search,
                    'plan' => $u->plan,
                    'effective_plan' => $u->effectivePlan(),
                    'plan_expires_at' => $u->plan_expires_at?->toISOString(),
                    'account_type' => $u->account_type ?? 'person',
                    'is_business' => $isBusiness,
                    'is_organization' => $isBusiness && ($businessRow ? $businessRow->isOrganization() : true),
                    'business' => $isBusiness ? [
                        'legal_form' => (string) ($businessRow->legal_form ?? 'ooo'),
                        'is_verified' => $businessRow ? $businessRow->isVerified() : false,
                        'verification_status' => (string) ($businessRow->verification_status ?? 'draft'),
                        'unp' => $businessRow?->unp,
                    ] : null,
                ];
            });
        return response()->json($mapped);
    }

    /**
     * Скрыть пользователя из поиска или вернуть обратно.
     *
     * Модератору запрещено трогать админов: скрытие чужого
     * админ-аккаунта доступно только полному администратору.
     *
     * @param Request $request запрос с флагом is_hidden_from_search
     * @param User $user целевой пользователь
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateVisibility(Request $request, User $user)
    {
        abort_if($user->isAdmin() && ! $request->user()->isAdmin(), 403, 'Модератор не может скрывать администратора');

        $data = $request->validate(['is_hidden_from_search' => 'required|boolean']);
        $user->forceFill(['is_hidden_from_search' => $data['is_hidden_from_search']])->save();
        return response()->json([
            'id' => $user->id,
            'is_hidden_from_search' => (bool) $user->is_hidden_from_search,
        ]);
    }

    public function ban(Request $request, User $user)
    {
        $data = $request->validate(['reason' => 'nullable|string|max:255']);
        abort_if($user->id === $request->user()->id, 422, 'Нельзя заблокировать себя');
        abort_if($user->isAdmin(), 403, 'Нельзя заблокировать администратора');
        $user->forceFill([
            'banned_at' => now(),
            'banned_reason' => $data['reason'] ?? 'Заблокирован администратором',
        ])->save();
        return response()->json(['id' => $user->id, 'banned_at' => $user->banned_at?->toISOString(), 'banned_reason' => $user->banned_reason]);
    }

    /**
     * Разбанить пользователя и полностью снять защиту входа.
     *
     * Без сброса LoginShield разбан оставлял заморозку («попробуйте через N мин»)
     * и следующий фейл снова вёл к автобану, поэтому здесь же вызываем thaw():
     * рвём цепочку фейлов success-маркером и чистим RateLimiter по всем IP.
     *
     * @param Request $request текущий запрос
     * @param User $user целевой пользователь
     * @return \Illuminate\Http\JsonResponse
     */
    public function unban(Request $request, User $user)
    {
        $user->forceFill(['banned_at' => null, 'banned_reason' => null])->save();

        \App\Services\LoginShield::thaw((string) $user->email, $user->id, 'admin:unban — разбан, счётчик фейлов и троттлинг сброшены');

        return response()->json(['id' => $user->id, 'banned_at' => null, 'banned_reason' => null, 'thawed' => true]);
    }

    /**
     * Удалить аккаунт пользователя целиком.
     *
     * Модератор может удалять только обычных пользователей:
     * удаление админа — только полным администратором.
     *
     * @param Request $request текущий запрос
     * @param User $user целевой пользователь
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'Нельзя удалить себя здесь — используйте удаление в Безопасности');
        abort_if($user->isAdmin() && ! $request->user()->isAdmin(), 403, 'Модератор не может удалить администратора');
        $user->delete();
        return response()->json(['ok' => true]);
    }
}
