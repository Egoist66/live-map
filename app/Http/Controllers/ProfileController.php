<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Services\CountryResolver;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Публичный профиль по слагу никнейма (`/users/anna-ivanova`).
     *
     * Числовой идентификатор (`/users/123`) тоже принимается для
     * совместимости со старыми ссылками, но отвечает 301 редиректом
     * на канонический слаг с сохранением query-строки (`?photo=`,
     * `?comment=`). Под капотом всё по-прежнему работает по id.
     *
     * @param Request $request запрос
     * @param string $profile слаг профиля либо числовой id
     */
    public function publicShow(Request $request, string $profile): Response|RedirectResponse
    {
        $slugService = app(\App\Services\ProfileSlugService::class);

        $user = $slugService->resolve($profile);

        abort_if($user === null, 404);

        $isNumericVisit = ctype_digit(trim($profile));

        if ($isNumericVisit && $user->profileIdentifier() !== trim($profile)) {
            return redirect()->route('users.show', array_merge(
                ['profile' => $user->profileIdentifier()],
                $request->query()
            ), 301);
        }

        $auth = $request->user();
        $isOwn = $auth && $auth->id === $user->id;
        if (!$isOwn && $auth && !$user->isDiscoverableBy($auth)) abort(404);
        if (!$isOwn && !$auth && ($user->is_hidden_from_search || (int) $user->id === \App\Models\User::GHOST_USER_ID)) abort(404);
        if (!$isOwn) {
            \App\Services\ProfileStatsService::recordView($auth, (int) $user->id);
        }
        $canMessage = $auth ? $auth->canMessageUser($user) : false;
        $reason = $auth ? $auth->messageBlockReason($user) : null;
        $friendship = null;
        $isFriend = false;
        $isPending = false;
        $isBlocked = false;
        $isBlockedBy = false;
        if ($auth && !$isOwn) {
            $friendship = \App\Models\Friendship::where(function($q) use ($auth,$user){
                $q->where('requester_id',$auth->id)->where('addressee_id',$user->id)
                  ->orWhere(fn($x)=>$x->where('requester_id',$user->id)->where('addressee_id',$auth->id));
            })->first();
            $isFriend = $friendship?->status==='accepted';
            $isPending = $friendship?->status==='pending';
            $isBlocked = \App\Models\UserBlock::where('blocker_id',$auth->id)->where('blocked_id',$user->id)->exists();
            $isBlockedBy = \App\Models\UserBlock::where('blocker_id',$user->id)->where('blocked_id',$auth->id)->exists();
        }
        $showLastSeen = $user->last_seen_at;
        if ($user->isInvisibleActive() && !$isOwn && !($auth && $auth->isAdmin())) {
            $showLastSeen = null;
        }
        $home = $user->publicHomeFor($auth);
        $base = $user->only(['id','profile_slug','name','gender','birth_date','country','country_code','avatar_path','level','reputation_score','created_at','home_city','home_visibility','home_radius_km','bio','thought','last_seen_at','is_invisible','photo_comments_privacy','dating_enabled','dating_goal','dating_custom_goal','dating_about','dating_interests']);
        if ($isOwn) {
            $base['dating_hide_name'] = (bool) $user->dating_hide_name;
            $base['dating_hide_age'] = (bool) $user->dating_hide_age;
            $base['dating_hide_distance'] = (bool) $user->dating_hide_distance;
            $base['dating_hide_rating'] = (bool) $user->dating_hide_rating;
            $base['dating_match_only'] = (bool) $user->dating_match_only;
        }
        $base['age'] = $user->age;
        $base['plan'] = $user->plan ?? 'free';
        $base['plan_expires_at'] = $user->plan_expires_at?->toISOString();
        $base['effective_plan'] = $user->effectivePlan();
        if (!$isOwn) unset($base['birth_date']);
        if ($isOwn) {
            $base['home_lat'] = $user->home_lat;
            $base['home_lng'] = $user->home_lng;
            $base['home_address'] = $user->home_address;
            $base['home_show_exact'] = (bool) $user->home_show_exact;
            $base['can_show_exact_home'] = $user->canShowExactHome();
            $base['email'] = $user->email;
            $base['email_verified_at'] = $user->email_verified_at?->toISOString();
        } elseif ($home) {
            $base['home_lat'] = $home['lat'];
            $base['home_lng'] = $home['lng'];
            $base['home_city'] = $home['city'];
            $base['home_address'] = $home['address'];
        } else {
            $base['home_lat'] = null;
            $base['home_lng'] = null;
            $base['home_city'] = $user->home_visibility === 'none' ? null : $user->home_city;
            $base['home_address'] = null;
        }
        if ($home) {
            $base['home_is_blurred'] = $home['is_blurred'];
            $base['home_blur_meters'] = $home['blur_meters'];
            $base['home_blur_label'] = $home['blur_label'];
        }
        $subscription = null;
        if ($auth && ! $isOwn) {
            $subscription = \App\Models\UserSubscription::where('subscriber_id', $auth->id)
                ->where('target_id', $user->id)
                ->first();
            if (! $isFriend) {
                $subscription = null;
            }
        }
        if ($user->isBusinessAccount()) {
            $company = \App\Models\Business::where('user_id', $user->id)
                ->orderByDesc('id')
                ->first();

            abort_if($company === null || ! $company->is_active, 404);

            $ads = \App\Models\BusinessAd::where('business_id', $company->id)
                ->orderByDesc('created_at')
                ->limit(30)
                ->get()
                ->map(fn (\App\Models\BusinessAd $ad) => $ad->toPublicArray())
                ->values()
                ->all();

            return Inertia::render('Business/Show', [
                'business' => $company->toPublicArray(),
                'owner' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'avatar_url' => $user->avatar_url,
                    'last_seen_at' => $showLastSeen?->toISOString(),
                ],
                'isOwn' => $isOwn,
                'canMessage' => $canMessage,
                'canMessageReason' => $reason,
                'isBlocked' => $isBlocked,
                'isBlockedBy' => $isBlockedBy,
                'initialAds' => $ads,
            ]);
        }

        return Inertia::render('Profile/Show', [
            'profileUser' => array_merge($base, ['avatar_url' => $user->avatar_url, 'last_seen_at' => $showLastSeen?->toISOString(), 'is_invisible' => $user->isInvisibleActive()]),
            'isOwn' => $isOwn,
            'friendship' => $friendship,
            'isFriend' => $isFriend,
            'isPending' => $isPending,
            'isBlocked' => $isBlocked,
            'isBlockedBy' => $isBlockedBy,
            'canMessage' => $canMessage,
            'canMessageReason' => $reason,
            'rating' => app(\App\Services\DatingReviewService::class)->summary($user, $auth),
            'subscription' => $subscription ? [
                'subscribed' => true,
                'notify_pin' => (bool) $subscription->notify_pin,
                'notify_photo' => (bool) $subscription->notify_photo,
                'notify_level' => (bool) $subscription->notify_level,
                'notify_post' => (bool) ($subscription->notify_post ?? true),
            ] : ['subscribed' => false, 'notify_pin' => true, 'notify_photo' => true, 'notify_level' => true, 'notify_post' => true],
        ]);
    }

    public function toggleInvisible(Request $request)
    {
        $user = $request->user();
        abort_unless($user->canUseInvisible(), 403, 'Недоступно для вашего тарифа');
        $request->validate(['is_invisible' => 'required|boolean']);
        $user->forceFill(['is_invisible' => $request->boolean('is_invisible')])->save();
        return response()->json(['is_invisible' => $user->isInvisibleActive(), 'can_use_invisible' => $user->canUseInvisible()]);
    }

    /**
     * Защита от дозвонов: если я отклонил звонок, тот же человек
     * не сможет перезвонить мне 5 минут. По умолчанию выключена.
     *
     * @param Request $request запрос с call_cooldown_enabled
     */
    public function updateCallCooldown(Request $request)
    {
        $request->validate(['call_cooldown_enabled' => 'required|boolean']);
        $request->user()->forceFill(['call_cooldown_enabled' => $request->boolean('call_cooldown_enabled')])->save();

        return response()->json(['call_cooldown_enabled' => (bool) $request->user()->call_cooldown_enabled]);
    }

    /**
     * Приём голосовых звонков: выключено — не дозвонится никто, даже друзья.
     * Исходящие звонки остаются доступны (как запрет входящих в Telegram).
     *
     * @param Request $request запрос с video_calls_enabled
     */
    public function updateVideoCalls(Request $request)
    {
        $request->validate(['video_calls_enabled' => 'required|boolean']);
        $request->user()->forceFill(['video_calls_enabled' => $request->boolean('video_calls_enabled')])->save();

        return response()->json(['video_calls_enabled' => (bool) $request->user()->video_calls_enabled]);
    }

    /**
     * Кто может комментировать посты пользователя в UFlow.
     *
     * @param Request $request запрос с flow_comments_privacy
     */
    public function updateFlowCommentsPrivacy(Request $request)
    {
        $request->validate(['flow_comments_privacy' => 'required|in:everyone,friends,none']);
        $request->user()->forceFill(['flow_comments_privacy' => $request->input('flow_comments_privacy')])->save();

        return response()->json(['flow_comments_privacy' => $request->user()->flow_comments_privacy]);
    }

    public function dashboard(Request $request, ?string $identifier = null): Response|RedirectResponse
    {
        $auth = $request->user();

        if ($auth === null) {
            return redirect()->route('login');
        }

        if ($identifier === null && $auth->isBusinessAccount()) {
            if ($auth->hasModule('business')) {
                return redirect()->route('cabinet.index');
            }

            return redirect($auth->landingPath());
        }
        if ($identifier === null) {
            $profileUser = $auth;
            return Inertia::render('Dashboard', [
                'user' => $profileUser,
                'isOwn' => true,
            ]);
        }
        if ($identifier === 'admin') {
            abort_unless($auth->isAdmin(), 403, 'Только админ');
            return Inertia::render('Admin/Index');
        } elseif (is_numeric($identifier)) {
            $profileUser = \App\Models\User::findOrFail((int) $identifier);
            if ($profileUser->id !== $auth->id && !$auth->isAdmin()) {
                return redirect()->route('users.show', ['profile' => $profileUser->profileIdentifier()]);
            }
        } else {
            abort(404);
        }
        return Inertia::render('Dashboard', [
            'user' => $profileUser,
            'isOwn' => $profileUser->id === $auth->id,
        ]);
    }

    /**
     * Display the user's profile form.
     */
    public function edit(Request $request, ?string $identifier = null, ?string $tab = null): Response|RedirectResponse
    {
        $auth = $request->user();

        if ($auth === null) {
            return redirect()->route('login');
        }

        $tabIds = ['profile', 'billing', 'quests', 'pins', 'privacy', 'appearance', 'security', 'procedures', 'support', 'app', 'integrations', 'about', 'admin', 'archive'];
        if ($tab === null && $identifier !== null && in_array($identifier, $tabIds, true) && $identifier !== 'admin') {
            $tab = $identifier;
            $identifier = null;
        }
        $initialTab = in_array($tab, $tabIds, true) && ($tab !== 'admin' || $auth->isAdmin()) ? $tab : null;
        // Стаффу подтверждение не предлагаем: гейт почты на него не
        // действует, при желании подтвердит из раздела «Безопасность».
        $mustVerifyEmail = $auth instanceof MustVerifyEmail && ! $auth->isModerator();
        if ($identifier === null) {
            $profileUser = $auth;
            return Inertia::render('Profile/Edit', [
                'mustVerifyEmail' => $mustVerifyEmail,
                'status' => session('status'),
                'user' => $profileUser,
                'initialTab' => $initialTab,
            ]);
        }
        if ($identifier === 'admin') {
            abort_unless($auth->isAdmin(), 403, 'Только админ');
            $profileUser = $auth;
        } elseif (is_numeric($identifier)) {
            $profileUser = \App\Models\User::findOrFail((int) $identifier);
            if ($profileUser->id !== $auth->id && !$auth->isAdmin()) abort(403, 'Чужой профиль');
        } else {
            abort(404);
        }
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $mustVerifyEmail,
            'status' => session('status'),
            'user' => $profileUser,
            'initialTab' => $initialTab,
        ]);
    }

    /**
     * Update the user's profile information.
     *
     * Смена почты сбрасывает подтверждение: до перехода по ссылке
     * из нового письма действуют ограничения неподтверждённой почты
     * (запрет лайков и сообщений через EmailVerificationGate).
     * Письмо со ссылкой уходит автоматически, повторная отправка —
     * из баннера/раздела «Безопасность».
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        if (! $user->isAdmin()) {
            CountryResolver::assertResidenceAllowed(
                $request->input('country', $user->country),
                $request->input('country_code', $user->country_code),
                $request->input('home_lat', $user->home_lat),
                $request->input('home_lng', $user->home_lng),
            );
        }
        $user->fill($request->safe()->except(['plan', 'plan_expires_at']));
        \App\Services\ContentModeration::assertClean($user->bio ?? null, $user->thought ?? null);
        if ($user->country_code) $user->country_code = mb_strtolower(trim((string) $user->country_code));
        if ($user->country) $user->country = trim(preg_replace('/\s+/', ' ', (string) $user->country));

        if ((bool) $user->home_show_exact && ! $user->canShowExactHome()) {
            $user->home_show_exact = false;
        }

        $meters = (int) ($user->default_blur_meters ?? 300);
        if ($meters > 1000 && !$user->canUseInvisible()) $meters = 1000;
        $user->default_blur_meters = max(0, min(5000, $meters));
        $user->default_location_precision = $user->default_blur_meters <= 0 ? 'exact' : 'custom';

        $emailChanged = $user->isDirty('email');

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($emailChanged) {
            try {
                $user->sendEmailVerificationNotification();
            } catch (\Throwable $e) {
                Log::warning('Не ушло письмо подтверждения после смены почты', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return Redirect::route('profile.edit')->with('status', 'verification-link-sent');
        }

        return Redirect::route('profile.edit');
    }

    /**
     * Смена стартового режима приложения (ULove-свайпы или UPin-карта).
     *
     * Без ограничений: пользователь всегда может пользоваться обеими
     * сторонами, режим влияет лишь на стартовый экран и подсказки.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateDefaultMode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'default_mode' => ['required', 'string', 'in:ulove,upin'],
        ]);

        $user = $request->user();
        $mode = mb_strtolower(trim((string) $data['default_mode']));

        $user->forceFill([
            'default_mode' => $mode,
            'default_mode_set_at' => now(),
        ])->save();

        return response()->json([
            'default_mode' => $user->default_mode,
            'landing' => $user->landingPath(),
        ]);
    }

    /**
     * Смена набора включённых модулей (изоляция ULove/UPin/UFlow/районы/бизнес).
     *
     * Первый модуль списка — primary (стартовый экран). Пустой список
     * запрещён: хотя бы один раздел всегда включён. ULove — базовый
     * раздел персоны: у не-бизнеса он принудительно первый, снять
     * его через API нельзя. Непрочитанные уведомления выключенных
     * разделов гаснут: бейджи и лента показывают текущий набор.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateAppModules(Request $request): JsonResponse
    {
        $data = $request->validate([
            'modules' => ['required', 'array', 'min:1'],
            'modules.*' => ['required', 'string', 'in:ulove,upin,uflow,districts,business'],
        ]);

        $user = $request->user();
        $modules = array_values(array_unique(array_map('strval', $data['modules'])));

        $global = \App\Services\AppSettings::globalModules();
        $modules = array_values(array_intersect($modules, $global));

        $isBusiness = ($user->account_type ?? null) === 'business';

        if (! $isBusiness && ! in_array('ulove', $modules, true)) {
            array_unshift($modules, 'ulove');
        }

        abort_if($modules === [], 422, 'Выбери хотя бы один раздел');

        $previous = $user->enabledModules() ?? $global;

        $user->setEnabledModules($modules);

        $removed = array_values(array_diff($previous, $modules));

        if ($removed !== []) {
            \App\Services\NotificationModuleGate::markDisabledRead($user, $removed);
        }

        return response()->json([
            'modules' => $user->enabledModules(),
            'global_modules' => $global,
            'default_mode' => $user->default_mode,
            'landing' => $user->landingPath(),
        ]);
    }

    /**
     * Быстрое обновление короткой мысли профиля (строка под именем).
     *
     * Для AJAX возвращает обновлённую запись, для Inertia — redirect back.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
     */
    public function updateThought(Request $request): RedirectResponse|JsonResponse
    {
        $data = $request->validate([
            'thought' => ['nullable', 'string', 'max:140'],
        ]);
        $raw = $data['thought'] ?? null;
        $thought = is_string($raw) ? trim((string) preg_replace('/\s+/u', ' ', strip_tags($raw))) : null;
        if ($thought === '') $thought = null;
        if ($thought !== null) $thought = mb_substr($thought, 0, 140);
        \App\Services\ContentModeration::assertClean($thought);
        $user = $request->user();
        $user->thought = $thought;
        $user->save();

        if ($request->wantsJson()) {
            return response()->json(['thought' => $user->thought]);
        }

        return back();
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
