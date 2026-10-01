<?php

namespace App\Models;

use Database\Factories\UserFactory;
use App\Casts\EncryptedTextCast;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\Storage;

#[Fillable(['name', 'profile_slug', 'email', 'password', 'gender', 'birth_date', 'country', 'country_code', 'plan', 'latitude', 'longitude', 'role', 'account_type', 'is_admin', 'is_hidden_from_search', 'profile_hidden_at', 'deletion_requested_at', 'deletion_scheduled_at', 'deletion_pro_until', 'dating_enabled', 'dating_goal', 'signup_goal', 'default_mode', 'default_mode_set_at', 'enabled_modules', 'dating_custom_goal', 'dating_about', 'dating_interests', 'dating_gender_pref', 'dating_hide_name', 'dating_hide_age', 'dating_hide_distance', 'dating_match_only', 'random_chats_used', 'random_chats_month', 'superlikes_day', 'superlikes_used', 'superlikes_balance', 'boosts_balance', 'boost_until', 'boost_month', 'undos_day', 'undos_used', 'avatar_path', 'home_lat', 'home_lng', 'home_city', 'home_address', 'home_visibility', 'home_show_exact', 'home_radius_km', 'bio', 'thought', 'reputation_score', 'level', 'quest_cooldown_until', 'quest_last_track', 'quest_granted_at', 'is_anonymous_default', 'default_location_precision', 'default_blur_meters', 'message_privacy', 'allow_random_messages', 'call_cooldown_enabled', 'video_calls_enabled', 'photo_comments_privacy', 'flow_comments_privacy', 'auto_reply_enabled', 'auto_reply_text', 'settings', 'last_seen_at', 'is_invisible', 'screen_lock_code', 'screen_lock_timeout', 'screen_lock_kind', 'plan_expires_at', 'pins_today_count', 'pins_today_date', 'stripe_id', 'pm_type', 'pm_last_four', 'trial_ends_at', 'terms_accepted_at', 'terms_version', 'telegram_id', 'telegram_username', 'telegram_photo_url', 'telegram_linked_at', 'telegram_notify_messages', 'telegram_notify_likes', 'telegram_notify_matches', 'telegram_notify_comments', 'telegram_blocked_at', 'telegram_notify_enabled', 'email_notify_messages', 'email_notify_likes', 'email_notify_matches', 'telegram_dm_messages', 'telegram_dm_likes', 'telegram_dm_matches', 'telegram_dm_comments'])]
#[Hidden(['password', 'remember_token', 'screen_lock_code'])]
/**
 * Пользователь приложения.
 *
 * @property string|null $signup_goal Цель захода: love|flirt|friendship|chat|interests везут в ULove-свайпы, neighbors — на карту.
 * @property string|null $default_mode Стартовый режим: ulove|upin. NULL — режим не выбран, показать модалку.
 * @property \Carbon\Carbon|null $default_mode_set_at Когда выбран стартовый режим.
 * @property array<string>|null $enabled_modules Включённые модули: ulove|upin|uflow|districts|business. NULL — legacy, все включены.
 * @property string $account_type Тип аккаунта: person|business. business ведёт в кабинет компании.
 * @property string|null $dating_goal Цель анкеты ULove.
 * @property string|null $thought Короткая мысль под именем в профиле (до 140 символов).
 * @property int|null $telegram_id Telegram user id (уникальный, для входа через Mini App).
 * @property string|null $telegram_username Username в Telegram без @.
 * @property string|null $telegram_photo_url Аватар из Telegram на момент привязки.
 * @property \Carbon\Carbon|null $telegram_linked_at Когда привязан Telegram.
 * @property \Carbon\Carbon|null $profile_hidden_at Анкета скрыта: никто не видит, возврат одним тапом.
 * @property \Carbon\Carbon|null $deletion_requested_at Когда пользователь запросил удаление профиля.
 * @property \Carbon\Carbon|null $deletion_scheduled_at Когда реально удалим всё из базы (+14 дней grace).
 * @property \Carbon\Carbon|null $deletion_pro_until До когда действует прощальная неделя PRO.
 * @property bool $telegram_notify_messages Слать в Telegram о новых сообщениях.
 * @property bool $telegram_notify_likes Слать в Telegram о лайках анкеты.
 * @property bool $telegram_notify_matches Слать в Telegram о взаимных мэтчах.
 * @property bool $telegram_notify_comments Слать в Telegram о комментариях.
 * @property \Carbon\Carbon|null $telegram_blocked_at Когда Bot API вернул 403 (нет /start или блок).
 * @property bool $telegram_notify_enabled Мастер-тумблер Telegram-дублей (бот-карточки и личка; выкл глушит всё разом).
 * @property bool $email_notify_messages Дублировать на почту новые сообщения.
 * @property bool $email_notify_likes Дублировать на почту лайки анкеты.
 * @property bool $email_notify_matches Дублировать на почту взаимные мэтчи.
 * @property bool $telegram_dm_messages Короткие личные дубли сообщений в чат с ботом.
 * @property bool $telegram_dm_likes Короткие личные дубли лайков в чат с ботом.
 * @property bool $telegram_dm_matches Короткие личные дубли мэтчей в чат с ботом.
 * @property bool $telegram_dm_comments Короткие личные дубли комментариев в чат с ботом.
 */
class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $appends = ['avatar_url', 'age', 'effective_plan'];

    /**
     * Дефолты модели: автоответ «меня нет онлайн» включён по умолчанию.
     *
     * @var array<string, mixed>
     */
    protected $attributes = [
        'auto_reply_enabled' => true,
    ];

    public function getEffectivePlanAttribute(): string
    {
        return $this->effectivePlan();
    }

    public function isPlanExpired(): bool
    {
        if (empty($this->plan) || $this->plan === 'free') return false;
        if ($this->plan_expires_at === null) return false;
        try {
            return \Carbon\Carbon::parse($this->plan_expires_at)->isPast();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Действующий тариф с учётом срока и роли.
     *
     * Стафф (админ/модератор) всегда на Premium: им доступен топ-тариф
     * по умолчанию без покупки. Business — только для организаторов
     * (role=organization, account_type=business).
     *
     * @return string free|pro|premium|business
     */
    public function effectivePlan(): string
    {
        if ($this->isModerator()) {
            return 'premium';
        }

        if ($this->isPlanExpired()) return 'free';
        return $this->plan ?? 'free';
    }

    /**
     * Техническая ли почта Telegram-регистрации (только логин, не для писем).
     *
     * Автосозданные через Mini App получают `tg_{id}@telegram.local` —
     * уведомления на неё не дойдут, нужна реальная почта в опциях бота.
     *
     * @return bool true когда почта техническая и её стоит заменить
     */
    public function hasTechnicalTelegramEmail(): bool
    {
        $email = mb_strtolower(trim((string) ($this->email ?? '')));

        if ($email === '') {
            return true;
        }

        return str_starts_with($email, 'tg_') && str_ends_with($email, '@telegram.local');
    }

    protected static function booted(): void
    {
        static::creating(function (self $user) {
            if (! $user->is_invisible && ($user->is_admin || $user->role === 'admin')) {
                $user->is_invisible = true;
            }

            self::ensureOrganizationDefaults($user);
            self::assignProfileSlug($user);
        });

        static::created(function (self $user) {
            self::replaceTemporaryProfileSlug($user);
        });

        static::updating(function (self $user) {
            if (($user->isDirty('is_admin') || $user->isDirty('role')) && $user->isAdmin() && ! $user->is_invisible) {
                $user->is_invisible = true;
            }

            if ($user->isDirty('name')) {
                $service = app(\App\Services\ProfileSlugService::class);

                $user->profile_slug = $service->uniqueSlug((string) $user->name, (int) $user->id);
            }
        });
    }

    /**
     * Дефолты организации при создании: кабинет = роль organization + тариф business.
     *
     * Раз зашли в кабинет — значит оплатили business: персонам (account_type=person)
     * ничего не трогаем, бизнесу без явного плана выдаём business +30 дней.
     * Роль organization ставим только когда роль ещё дефолтная (user/пусто),
     * чтобы сиды и админ-импорт с явной ролью не перезаписывались.
     *
     * @param self $user создаваемый пользователь
     * @return void
     */
    private static function ensureOrganizationDefaults(self $user): void
    {
        $isBusiness = ($user->account_type ?? 'person') === 'business';

        if (! $isBusiness) {
            return;
        }

        $role = trim((string) ($user->role ?? ''));

        if ($role === '' || $role === 'user') {
            $user->role = 'organization';
        }

        $plan = trim((string) ($user->plan ?? ''));

        if ($plan === '' || $plan === 'free') {
            $user->plan = 'business';

            if (empty($user->plan_expires_at)) {
                $user->plan_expires_at = now()->addDays(30);
            }
        }
    }

    /**
     * Назначить слаг профиля из имени, если он пуст.
     *
     * Ручной `profile_slug` (импорт, сиды) не перезаписывается.
     * Уже занятый слаг не правится здесь — уникальность гарантирует
     * сервис генерацией суффикса.
     *
     * @param self $user создаваемый либо обновляемый пользователь
     * @return void
     */
    private static function assignProfileSlug(self $user): void
    {
        $stored = trim((string) ($user->profile_slug ?? ''));

        if ($stored !== '') {
            return;
        }

        $service = app(\App\Services\ProfileSlugService::class);

        $ignoreId = $user->exists ? (int) $user->id : null;

        $user->profile_slug = $service->uniqueSlug((string) ($user->name ?? ''), $ignoreId);
    }

    /**
     * Заменить временный слаг (`user`, `user-N`) на `user-{id}`.
     *
     * Временный слаг ставится при создании, когда id ещё неизвестен
     * (пустое либо числовое имя). После вставки id известен —
     * делаем детерминированный фолбэк без перезаписи событий.
     *
     * @param self $user только что созданный пользователь
     * @return void
     */
    private static function replaceTemporaryProfileSlug(self $user): void
    {
        $stored = trim((string) ($user->profile_slug ?? ''));

        $isTemporary = preg_match('/^user(-\d+)?$/', $stored) === 1;

        if (! $isTemporary) {
            return;
        }

        $service = app(\App\Services\ProfileSlugService::class);

        $slug = $service->uniqueSlug((string) ($user->name ?? ''), (int) $user->id);

        $user->forceFill(['profile_slug' => $slug])->saveQuietly();
    }

    /**
     * Канонический идентификатор профиля для URL: слаг либо id.
     *
     * @return string слаг профиля или числовой id строкой
     */
    public function profileIdentifier(): string
    {
        $stored = trim((string) ($this->profile_slug ?? ''));

        if ($stored !== '') {
            return $stored;
        }

        return (string) (int) $this->id;
    }

    /**
     * Диск для аватаров: S3 когда он настроен, иначе локальный public.
     *
     * Единая точка выбора диска для записи и чтения, чтобы URL
     * никогда не указывал на другой диск, чем загруженный файл.
     */
    public static function avatarDisk(): string
    {
        $isS3 = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket');
        return $isS3 ? 's3' : 'public';
    }

    protected function avatarUrl(): Attribute
    {
        return Attribute::get(function (): ?string {
            if ($this->avatar_path) {
                return Storage::disk(self::avatarDisk())->url($this->avatar_path);
            }

            $telegramPhoto = trim((string) ($this->telegram_photo_url ?? ''));

            if ($telegramPhoto !== '' && str_starts_with($telegramPhoto, 'https://')) {
                return $telegramPhoto;
            }

            return null;
        });
    }

    protected function age(): Attribute
    {
        return Attribute::get(function (): ?int {
            if (!$this->birth_date) return null;
            try {
                $d = $this->birth_date instanceof \DateTimeInterface ? \Carbon\Carbon::parse($this->birth_date) : \Carbon\Carbon::parse((string) $this->birth_date);
                return $d->age;
            } catch (\Throwable) {
                return null;
            }
        });
    }

    public function pins() { return $this->hasMany(Pin::class); }
    public function comments() { return $this->hasMany(PinComment::class); }
    public function reactions() { return $this->hasMany(Reaction::class); }
    public function zoneSubscriptions() { return $this->hasMany(ZoneSubscription::class); }
    public function businesses() { return $this->hasMany(Business::class); }
    public function reports() { return $this->hasMany(Report::class, 'reporter_id'); }
    public function blocks() { return $this->hasMany(UserBlock::class, 'blocker_id'); }
    public function blockedBy() { return $this->hasMany(UserBlock::class, 'blocked_id'); }
    public function friendships() { return $this->hasMany(Friendship::class, 'requester_id'); }
    public function friendshipsReceived() { return $this->hasMany(Friendship::class, 'addressee_id'); }
    public function conversations() { return $this->belongsToMany(Conversation::class, 'conversation_participants')->withPivot('last_read_at','joined_at'); }
    public function pushSubscriptions() { return $this->hasMany(PushSubscription::class); }
    public function expoPushTokens() { return $this->hasMany(ExpoPushToken::class); }
    public function profilePhotos() { return $this->hasMany(ProfilePhoto::class); }
    public function subscriptions() { return $this->hasMany(UserSubscription::class, 'subscriber_id'); }
    public function subscribers() { return $this->hasMany(UserSubscription::class, 'target_id'); }
    public function flowPosts() { return $this->hasMany(FlowPost::class); }
    public function flowComments() { return $this->hasMany(FlowPostComment::class); }
    public function districts() { return $this->hasMany(District::class); }
    public function districtMemberships() { return $this->hasMany(DistrictMember::class); }

    /**
     * Все допустимые тарифы: free — бесплатный, pro — платный,
     * premium — топ для стаффа (админ/модератор, всегда по умолчанию),
     * business — только для организаторов (кабинет компании).
     */
    public const PLANS = ['free', 'pro', 'premium', 'business'];

    /** Топ-тарифы с максимальными лимитами (premium для стаффа, business для организаторов). */
    public const TOP_PLANS = ['premium', 'business'];

    /** Платные тарифы с PRO-плюшками (pro + оба топа). */
    public const PAID_PLANS = ['pro', 'premium', 'business'];

    /**
     * Все допустимые роли: user — персона, organization — компания
     * (кабинет, тариф business), moderator/admin — staff панели модерации.
     */
    public const ROLES = ['user', 'moderator', 'admin', 'organization'];

    public function isAdmin(): bool { return $this->is_admin || $this->role === 'admin'; }
    public function isBanned(): bool { return $this->banned_at !== null; }
    public function isModerator(): bool { return $this->isAdmin() || $this->role === 'moderator'; }
    public function hasRole(string $role): bool { return $this->role === $role || $this->isAdmin(); }

    /**
     * Организация ли это (роль organization — кабинет компании).
     *
     * Роль не даёт staff-прав: модерация только у moderator/admin.
     *
     * @return bool true когда role=organization
     */
    public function isOrganization(): bool { return $this->role === 'organization'; }

    public const FREE_PINS_LIMIT = 3;
    public const FREE_PIN_INVITES_MONTH_LIMIT = 3;
    public const FREE_DISTRICTS_LIMIT = 2;
    public const PRO_DISTRICTS_LIMIT = 5;
    public const BUSINESS_DISTRICTS_LIMIT = 15;

    public function livePinsCount(): int
    {
        return $this->pins()
            ->whereIn('status', ['active', 'scheduled'])
            ->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->count();
    }

    public function canCreatePin(): bool
    {
        if ($this->isAdmin()) return true;
        if (in_array($this->effectivePlan(), self::PAID_PLANS, true)) return true;
        return $this->livePinsCount() < self::FREE_PINS_LIMIT;
    }

    /**
     * Лимит своих UDistrict-районов по тарифу.
     *
     * Free — 2, Pro — 5, Premium/Business — 15, админ — безлимит (null).
     *
     * @return int|null максимум районов, null — безлимит
     */
    public function districtsLimit(): ?int
    {
        if ($this->isAdmin()) return null;
        return match ($this->effectivePlan()) {
            'business', 'premium' => self::BUSINESS_DISTRICTS_LIMIT,
            'pro' => self::PRO_DISTRICTS_LIMIT,
            default => self::FREE_DISTRICTS_LIMIT,
        };
    }

    /**
     * Может ли пользователь создать ещё один район.
     *
     * @return bool true когда лимит тарифа не исчерпан
     */
    public function canCreateDistrict(): bool
    {
        $limit = $this->districtsLimit();
        if ($limit === null) return true;
        return $this->districts()->count() < $limit;
    }

    /**
     * Сколько приглашений в пины отправлено с начала месяца.
     *
     * @return int количество созданных pin_invites за текущий месяц
     */
    public function pinInvitesUsedThisMonth(): int
    {
        return PinInvite::where('inviter_id', $this->id)
            ->where('created_at', '>=', now()->startOfMonth())
            ->count();
    }

    /**
     * Может ли пользователь отправить ещё одно приглашение в пин.
     *
     * Free — 3 в месяц, pro/premium/business/admin — безлимит.
     *
     * @return bool true когда лимит не исчерпан
     */
    public function canInviteToPin(): bool
    {
        if ($this->isAdmin()) return true;
        if (in_array($this->effectivePlan(), self::PAID_PLANS, true)) return true;
        return $this->pinInvitesUsedThisMonth() < self::FREE_PIN_INVITES_MONTH_LIMIT;
    }

    public function pinTtlHours(): ?int
    {
        if ($this->isAdmin()) return null;
        if (in_array($this->effectivePlan(), self::TOP_PLANS, true)) return null;
        if ($this->effectivePlan() === 'pro') return 12;
        return 4;
    }

    public function pinRadius(): int
    {
        if ($this->isAdmin()) return 500000;
        if (in_array($this->effectivePlan(), self::TOP_PLANS, true)) return 50000;
        if ($this->effectivePlan() === 'pro') return 15000;
        return 10000;
    }

    public function homeRadiusLimit(): int
    {
        if ($this->isAdmin()) return 500;
        if (in_array($this->effectivePlan(), self::TOP_PLANS, true)) return 50;
        if ($this->effectivePlan() === 'pro') return 15;
        return 10;
    }

    /**
     * Фактический радиус домашней зоны с учётом тарифа.
     */
    public function homeZoneRadiusKm(): int
    {
        $wanted = (int) ($this->home_radius_km ?? $this->homeRadiusLimit());
        $wanted = max(1, $wanted);
        return min($wanted, $this->homeRadiusLimit());
    }

    /**
     * Есть ли у пользователя платные PRO-плюшки.
     *
     * Стафф (админ/модератор) — всегда true: им доступен Premium
     * по умолчанию. Остальным — по действующему тарифу
     * pro/premium/business.
     *
     * @return bool true когда доступны PRO-функции
     */
    public function isPro(): bool { return $this->isModerator() || in_array($this->effectivePlan(), self::PAID_PLANS, true); }

    /**
     * Топ-тариф ли это (максимальные лимиты).
     *
     * Стафф — всегда true (Premium по умолчанию),
     * остальные — при действующем premium/business.
     *
     * @return bool true для premium/business и стаффа
     */
    public function isPremium(): bool { return $this->isModerator() || in_array($this->effectivePlan(), self::TOP_PLANS, true); }

    /**
     * Стартовый режим приложения для пользователя.
     *
     * Явный default_mode приоритетнее, иначе фолбэк по signup_goal
     * для совместимости со старыми записями.
     *
     * @return string ulove|upin
     */
    public function defaultMode(): string
    {
        $mode = mb_strtolower(trim((string) ($this->default_mode ?? '')));

        if (in_array($mode, ['ulove', 'upin'], true)) {
            return $mode;
        }

        if (($this->signup_goal ?? '') === 'neighbors') {
            return 'upin';
        }

        return 'ulove';
    }

    /**
     * Выбран ли стартовый режим явно (не фолбэк).
     *
     * @return bool true когда default_mode заполнен
     */
    public function hasChosenDefaultMode(): bool
    {
        return in_array($this->default_mode, ['ulove', 'upin'], true);
    }

    /**
     * Бизнес-аккаунт ли это (персона vs компания).
     *
     * @return bool true для account_type=business
     */
    public function isBusinessAccount(): bool
    {
        return ($this->account_type ?? 'person') === 'business';
    }

    /**
     * Краткая сводка организации для диалогов/админки.
     *
     * Только для account_type=business с профилем ООО/ИП и др:
     * возвращает legal_form + is_organization + статус проверки.
     * Для персон — null, фронт скрывает бейдж.
     *
     * @return array{legal_form:string,is_organization:bool,is_verified:bool,verification_status:string,name:string}|null
     */
    public function businessBrief(): ?array
    {
        if (! $this->isBusinessAccount()) {
            return null;
        }

        try {
            $business = $this->activeBusiness();
        } catch (\Throwable) {
            $business = null;
        }

        if (! $business) {
            return [
                'legal_form' => 'ooo',
                'is_organization' => true,
                'is_verified' => false,
                'verification_status' => 'draft',
                'name' => (string) ($this->name ?? ''),
            ];
        }

        return [
            'legal_form' => (string) ($business->legal_form ?? 'ooo'),
            'is_organization' => $business->isOrganization(),
            'is_verified' => $business->isVerified(),
            'verification_status' => (string) ($business->verification_status ?? 'draft'),
            'name' => (string) ($business->name ?? $this->name ?? ''),
        ];
    }

    /**
     * Активный бизнес-профиль владельца (первый активный).
     *
     * @return \App\Models\Business|null
     */
    public function activeBusiness(): ?Business
    {
        if (! $this->relationLoaded('businesses')) {
            $this->load('businesses');
        }

        $list = $this->getRelation('businesses');

        foreach ($list as $business) {
            if ((bool) $business->is_active) {
                return $business;
            }
        }

        return $list->first();
    }

    /**
     * URL стартового экрана по режиму.
     *
     * Бизнес-аккаунты всегда стартуют с кабинета /business,
     * остальные — по default_mode (UPin → /map, иначе /swipes).
     *
     * @return string путь кабинета бизнеса либо карты/свайпов
     */
    public function landingPath(): string
    {
        $enabled = $this->enabledModules();

        if ($this->isBusinessAccount()) {
            if ($enabled !== null && ! in_array('business', $enabled, true)) {
                return $this->modulePath($enabled[0] ?? 'upin');
            }

            return route('cabinet.index', absolute: false);
        }

        if ($enabled !== null) {
            return $this->modulePath($enabled[0] ?? $this->defaultMode());
        }

        if ($this->defaultMode() === 'upin') {
            return route('map', absolute: false);
        }

        return route('swipes', absolute: false);
    }

    /**
     * Путь стартового экрана модуля.
     *
     * @param string $module ulove|upin|uflow|districts|business
     * @return string
     */
    private function modulePath(string $module): string
    {
        return match ($module) {
            'upin' => route('map', absolute: false),
            'uflow' => route('flow', absolute: false),
            'districts' => route('districts.index', absolute: false),
            'business' => route('cabinet.index', absolute: false),
            default => route('swipes', absolute: false),
        };
    }

    /**
     * Сохраняет стартовый режим пользователя.
     *
     * @param string $mode ulove|upin
     * @return void
     */
    public function setDefaultMode(string $mode): void
    {
        $normalized = mb_strtolower(trim($mode));

        abort_unless(in_array($normalized, ['ulove', 'upin'], true), 422, 'Неизвестный режим');

        $this->forceFill([
            'default_mode' => $normalized,
            'default_mode_set_at' => now(),
        ])->save();
    }

    /**
     * Все модули приложения, известные системе.
     *
     * @return string[]
     */
    public static function allModules(): array
    {
        return ['ulove', 'upin', 'uflow', 'districts', 'business'];
    }

    /**
     * Включённые модули пользователя.
     *
     * NULL в базе = legacy-режим: человек пользовался всем сразу,
     * ничего не скрываем. Явный массив = изоляция: виден только
     * выбранный набор, остальное довключается в настройках.
     *
     * @return string[]|null null — legacy (все включены)
     */
    public function enabledModules(): ?array
    {
        $raw = $this->enabled_modules;

        if ($raw === null) {
            return null;
        }

        $allowed = self::allModules();
        $clean = array_values(array_intersect(array_map('strval', (array) $raw), $allowed));

        return $clean === [] ? [$this->defaultMode()] : $clean;
    }

    /**
     * Включён ли модуль с учётом legacy-режима.
     *
     * @param string $module ulove|upin|uflow|districts|business
     * @return bool
     */
    public function hasModule(string $module): bool
    {
        $enabled = $this->enabledModules();

        if ($enabled === null) {
            return true;
        }

        return in_array($module, $enabled, true);
    }

    /**
     * Сохраняет набор включённых модулей и стартовый экран.
     *
     * Первый модуль списка становится primary: он же пишется
     * в default_mode для совместимости (ulove|upin), бизнес
     * стартует с кабинета через landingPath.
     *
     * @param string[] $modules непустой список из allModules()
     * @return void
     */
    public function setEnabledModules(array $modules): void
    {
        $allowed = self::allModules();
        $clean = array_values(array_intersect(array_map('strval', $modules), $allowed));

        abort_if($clean === [], 422, 'Выбери хотя бы один раздел');

        $primary = $clean[0];
        $payload = ['enabled_modules' => $clean];

        if (in_array($primary, ['ulove', 'upin'], true)) {
            $payload['default_mode'] = $primary;
            $payload['default_mode_set_at'] = now();
        }

        $this->forceFill($payload)->save();
    }

    public function canUseIncognitoLike(): bool { return $this->isPro(); }

    public function canUseInvisible(): bool { return $this->isModerator() || in_array($this->effectivePlan(), self::PAID_PLANS, true); }

    public function hiddenFriendsLimit(): ?int
    {
        if ($this->isAdmin()) return null;
        return match ($this->effectivePlan()) {
            'business', 'premium' => null,
            'pro' => 3,
            default => 1,
        };
    }

    public function hiddenFriendsCount(): int
    {
        return \App\Models\Friendship::where('status', 'accepted')
            ->where(function ($q) {
                $q->where(function ($x) { $x->where('requester_id', $this->id)->where('hidden_by_requester', true); })
                  ->orWhere(function ($x) { $x->where('addressee_id', $this->id)->where('hidden_by_addressee', true); });
            })->count();
    }

    public function canHideFriend(?int $exceptFriendshipId = null): bool
    {
        $limit = $this->hiddenFriendsLimit();
        if ($limit === null) return true;
        $count = \App\Models\Friendship::where('status', 'accepted')
            ->where('id', '!=', $exceptFriendshipId ?? 0)
            ->where(function ($q) {
                $q->where(function ($x) { $x->where('requester_id', $this->id)->where('hidden_by_requester', true); })
                  ->orWhere(function ($x) { $x->where('addressee_id', $this->id)->where('hidden_by_addressee', true); });
            })->count();
        return $count < $limit;
    }

    public function isInvisibleActive(): bool { return (bool) $this->is_invisible && $this->canUseInvisible(); }

    public function canShowExactHome(): bool { return $this->isModerator() || in_array($this->effectivePlan(), self::PAID_PLANS, true); }

    public function effectiveHomeBlurMeters(): int
    {
        if ($this->canShowExactHome() && (bool) $this->home_show_exact) return 0;
        return max(300, (int) ($this->default_blur_meters ?? 300));
    }

    public function canSeeHome(?User $viewer): bool
    {
        if ($viewer && ($viewer->id === $this->id || $viewer->isAdmin())) return true;
        if ($this->home_lat === null || $this->home_lng === null) return false;
        return match ($this->home_visibility ?? 'everyone') {
            'everyone' => true,
            'friends' => $viewer ? Friendship::areFriends($viewer->id, $this->id) : false,
            'none' => false,
        };
    }

    public function publicHomeFor(?User $viewer): ?array
    {
        if (! $this->canSeeHome($viewer)) return null;
        $blur = $this->effectiveHomeBlurMeters();
        $lat = (float) $this->home_lat;
        $lng = (float) $this->home_lng;
        if ($blur > 0) [$lat, $lng] = Pin::blurCoords($lat, $lng, $blur);
        return [
            'city' => $this->home_city,
            'address' => $blur > 0 ? null : $this->home_address,
            'lat' => round($lat, 7),
            'lng' => round($lng, 7),
            'is_blurred' => $blur > 0,
            'blur_meters' => $blur,
            'blur_label' => $blur > 0 ? Pin::formatMeters($blur) : null,
        ];
    }

    public function canModerate(): bool { return $this->isModerator(); }

    /**
     * Лимит фото в галерее профиля по тарифу.
     *
     * Free даёт 5 бесплатных фото, Pro — 6, Premium/Business/админ — 15.
     *
     * @return int максимальное число фото
     */
    public function photoLimit(): int
    {
        if ($this->isAdmin()) return 15;
        return match ($this->effectivePlan()) {
            'business', 'premium' => 15,
            'pro' => 6,
            default => 5,
        };
    }

    public function profilePhotosCount(): int
    {
        return $this->profilePhotos()->count();
    }

    public function canAddProfilePhoto(): bool
    {
        return $this->profilePhotosCount() < $this->photoLimit();
    }

    public function canCommentProfilePhoto(User $owner): bool
    {
        if ($this->id === $owner->id || $this->isAdmin()) return true;
        return match ($owner->photo_comments_privacy ?? 'everyone') {
            'everyone' => true,
            'friends' => Friendship::areFriends($this->id, $owner->id),
            'none' => false,
            default => true,
        };
    }

    /**
     * Может ли смотрящий комментировать посты автора в UFlow.
     *
     * Свои посты и админ — всегда, остальные по настройке автора
     * flow_comments_privacy: everyone|friends|none (как у фото).
     *
     * @param User $owner автор поста
     */
    public function canCommentFlowPost(User $owner): bool
    {
        if ($this->id === $owner->id || $this->isAdmin()) return true;
        return match ($owner->flow_comments_privacy ?? 'everyone') {
            'everyone' => true,
            'friends' => Friendship::areFriends($this->id, $owner->id),
            'none' => false,
            default => true,
        };
    }

    public function pinnedMessagesLimit(): ?int
    {
        if ($this->isAdmin()) return null;
        return match ($this->effectivePlan()) {
            'business', 'premium' => 20,
            'pro' => 6,
            default => 3,
        };
    }

    public function canDeletePin(Pin $pin): bool { return $this->isAdmin() || $pin->user_id === $this->id; }

    public function canManageBusiness(?Business $business = null): bool
    {
        if ($this->isAdmin()) return true;
        if (!$business) return $this->effectivePlan() === 'business' || $this->isPro();
        return $this->id === $business->user_id || $this->isAdmin();
    }

    public function canMessageUser(User $other): bool { return $this->messageBlockReason($other) === null; }

    /**
     * Причина ограничений из-за неподтверждённой почты.
     *
     * Без верификации запрещены лайки в свайпах и отправка сообщений:
     * доступны только просмотр ленты, избранное и чтение чатов.
     * Стафф (админы и модераторы) от гейта освобождён: подтверждение
     * почты для них добровольное, делается из настроек при желании.
     *
     * @return string|null текст причины либо null когда писать и лайкать можно
     */
    public function emailGateReason(): ?string
    {
        if ($this->isModerator()) {
            return null;
        }

        if ($this->hasVerifiedEmail()) {
            return null;
        }

        return 'Подтвердите почту — без этого нельзя лайкать и писать сообщения';
    }

    /**
     * Может ли пользователь лайкать в свайпах.
     *
     * @return bool true когда почта подтверждена либо это админ
     */
    public function canSwipeLike(): bool
    {
        return $this->emailGateReason() === null;
    }

    /**
     * Может ли пользователь отправлять сообщения.
     *
     * @return bool true когда почта подтверждена либо это админ
     */
    public function canWriteMessages(): bool
    {
        return $this->emailGateReason() === null;
    }

    public function messageBlockReason(User $other): ?string
    {
        if ($this->id === $other->id) return 'Нельзя писать себе';
        if ($this->isAdmin()) return null;
        if ($this->emailGateReason() !== null) return $this->emailGateReason();
        if (UserBlock::where('blocker_id', $other->id)->where('blocked_id', $this->id)->exists()) return 'Пользователь заблокировал вас';
        if (UserBlock::where('blocker_id', $this->id)->where('blocked_id', $other->id)->exists()) return 'Вы заблокировали пользователя';
        if ($other->isAdmin() && !Friendship::areFriends($this->id, $other->id)) return 'Сначала добавьте администратора в друзья';
        if ($other->message_privacy === 'none') return 'Пользователь закрыл личные сообщения';
        $isMatch = DatingMatch::between($this->id, $other->id) !== null;
        $isFriend = Friendship::areFriends($this->id, $other->id);
        if ($isMatch) return null;
        if ($other->message_privacy === 'friends' && !$isFriend) return 'Только друзья могут писать этому пользователю';
        if ($other->dating_match_only && !$isFriend) return 'Пользователь принимает сообщения только при взаимном мэтче';
        return null;
    }

    public const GHOST_USER_ID = 4;    public const GHOST_SEER_EMAIL = 'fmahmudov1997@mail.ru';

    public static function isGhostSeer(?User $viewer): bool
    {
        if (!$viewer) return false;
        if ($viewer->isAdmin()) return true;
        return mb_strtolower(trim((string) $viewer->email)) === self::GHOST_SEER_EMAIL;
    }

    public function isDiscoverableBy(User $viewer): bool
    {
        if ($viewer->id === $this->id || $viewer->isAdmin()) return true;
        if ($this->isAdmin()) {
            if (! $this->is_hidden_from_search) return true;
            return Friendship::areFriends($viewer->id, $this->id);
        }
        if ((int) $this->id === self::GHOST_USER_ID) return self::isGhostSeer($viewer);
        if ($this->isProfileHidden()) return false;
        if ($this->isPendingDeletion()) return false;
        return !$this->is_hidden_from_search;
    }

    public static function hiddenFromSearchFor(User $viewer): array
    {
        if ($viewer->isAdmin()) return [];
        $ids = static::where('is_hidden_from_search', true)->where('id', '!=', $viewer->id)->pluck('id')->all();
        $stealth = static::where('id', '!=', $viewer->id)
            ->where(function ($q) {
                $q->whereNotNull('profile_hidden_at')
                    ->orWhereNotNull('deletion_requested_at');
            })->pluck('id')->all();
        $ids = array_merge($ids, $stealth);
        if (!self::isGhostSeer($viewer) && (int) $viewer->id !== self::GHOST_USER_ID) $ids[] = self::GHOST_USER_ID;
        return array_values(array_unique(array_map('intval', $ids)));
    }

    /**
     * Скрыта ли анкета (режим «меня никто не видит»).
     *
     * @return bool true когда profile_hidden_at заполнен
     */
    public function isProfileHidden(): bool
    {
        return $this->profile_hidden_at !== null;
    }

    /**
     * Висит ли запрос на удаление (grace-период до hard delete).
     *
     * @return bool true когда deletion_requested_at заполнен
     */
    public function isPendingDeletion(): bool
    {
        return $this->deletion_requested_at !== null;
    }

    /**
     * Сколько дней осталось до необратимого удаления.
     *
     * @return int|null дней до deletion_scheduled_at, null когда удаления нет
     */
    public function deletionDaysLeft(): ?int
    {
        if ($this->deletion_scheduled_at === null) {
            return null;
        }

        $now = now();
        $target = $this->deletion_scheduled_at;

        if ($target->isPast()) {
            return 0;
        }

        return (int) $now->diffInDays($target);
    }

    public function unreadMessagesCount(): int
    {
        return Message::whereIn('conversation_id', $this->conversations()->pluck('conversations.id'))
            ->where('sender_id','!=',$this->id)
            ->whereNull('read_at')
            ->count();
    }

    /**
     * Дефолтный текст автоответа, когда свой не задан.
     */
    public const AUTO_REPLY_DEFAULT = '👋 Привет! Меня сейчас нет в приложении — отвечу, как только зайду.';

    /**
     * Считается ли пользователь отошедшим (для автоответа).
     *
     * Порог 3 минуты совпадает с фронтовым ONLINE_THRESHOLD_MS.
     *
     * @return bool true если last_seen_at отсутствует или старше порога
     */
    public function isAway(): bool
    {
        if (! $this->last_seen_at) {
            return true;
        }

        try {
            return $this->last_seen_at->lt(now()->subMinutes(3));
        } catch (\Throwable) {
            return true;
        }
    }

    /**
     * Текст автоответа: свой или дефолтный.
     *
     * @return string готовый текст сообщения
     */
    public function autoReplyTextOrDefault(): string
    {
        $custom = trim((string) ($this->auto_reply_text ?? ''));

        if ($custom !== '') {
            return mb_substr($custom, 0, 500);
        }

        return self::AUTO_REPLY_DEFAULT;
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'birth_date' => 'date',
            'home_lat' => 'decimal:7',
            'home_lng' => 'decimal:7',
            'home_show_exact' => 'boolean',
            'settings' => 'array',
            'dating_enabled' => 'boolean',
            'dating_interests' => 'array',
            'dating_hide_name' => 'boolean',
            'dating_hide_age' => 'boolean',
            'dating_hide_distance' => 'boolean',
            'dating_match_only' => 'boolean',
            'superlikes_day' => 'date',
            'boost_until' => 'datetime',
            'is_anonymous_default' => 'boolean',
            'allow_random_messages' => 'boolean',
            'call_cooldown_enabled' => 'boolean',
            'video_calls_enabled' => 'boolean',
            'auto_reply_enabled' => 'boolean',
            'is_admin' => 'boolean',
            'is_hidden_from_search' => 'boolean',
            'is_invisible' => 'boolean',
            'last_seen_at' => 'datetime',
            'plan_expires_at' => 'datetime',
            'quest_cooldown_until' => 'datetime',
            'quest_granted_at' => 'datetime',
            'default_mode_set_at' => 'datetime',
            'enabled_modules' => 'array',
            'banned_at' => 'datetime',
            'pins_today_date' => 'date',
            'trial_ends_at' => 'datetime',
            'telegram_linked_at' => 'datetime',
            'profile_hidden_at' => 'datetime',
            'deletion_requested_at' => 'datetime',
            'deletion_scheduled_at' => 'datetime',
            'deletion_pro_until' => 'datetime',
            'telegram_notify_messages' => 'boolean',
            'telegram_notify_likes' => 'boolean',
            'telegram_notify_matches' => 'boolean',
            'telegram_notify_comments' => 'boolean',
            'telegram_blocked_at' => 'datetime',
            'telegram_notify_enabled' => 'boolean',
            'email_notify_messages' => 'boolean',
            'email_notify_likes' => 'boolean',
            'email_notify_matches' => 'boolean',
            'telegram_dm_messages' => 'boolean',
            'telegram_dm_likes' => 'boolean',
            'telegram_dm_matches' => 'boolean',
            'telegram_dm_comments' => 'boolean',
            'bio' => EncryptedTextCast::class,
            'thought' => EncryptedTextCast::class,
            'dating_about' => EncryptedTextCast::class,
            'dating_custom_goal' => EncryptedTextCast::class,
        ];
    }
}
