<?php

namespace App\Models;

use Database\Factories\UserFactory;
use App\Casts\EncryptedTextCast;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\Storage;

#[Fillable(['name', 'profile_slug', 'email', 'password', 'gender', 'birth_date', 'country', 'country_code', 'plan', 'latitude', 'longitude', 'role', 'account_type', 'is_admin', 'is_hidden_from_search', 'dating_enabled', 'dating_goal', 'signup_goal', 'default_mode', 'default_mode_set_at', 'dating_custom_goal', 'dating_about', 'dating_interests', 'dating_gender_pref', 'dating_hide_name', 'dating_hide_age', 'dating_hide_distance', 'dating_match_only', 'random_chats_used', 'random_chats_month', 'avatar_path', 'home_lat', 'home_lng', 'home_city', 'home_address', 'home_visibility', 'home_show_exact', 'home_radius_km', 'bio', 'thought', 'reputation_score', 'level', 'quest_cooldown_until', 'quest_last_track', 'quest_granted_at', 'is_anonymous_default', 'default_location_precision', 'default_blur_meters', 'message_privacy', 'allow_random_messages', 'call_cooldown_enabled', 'video_calls_enabled', 'photo_comments_privacy', 'flow_comments_privacy', 'auto_reply_enabled', 'auto_reply_text', 'settings', 'last_seen_at', 'is_invisible', 'screen_lock_code', 'screen_lock_timeout', 'screen_lock_kind', 'plan_expires_at', 'pins_today_count', 'pins_today_date', 'stripe_id', 'pm_type', 'pm_last_four', 'trial_ends_at', 'terms_accepted_at', 'terms_version'])]
#[Hidden(['password', 'remember_token', 'screen_lock_code'])]
/**
 * Пользователь приложения.
 *
 * @property string|null $signup_goal Цель захода: love|flirt|friendship|chat|interests везут в ULove-свайпы, neighbors — на карту.
 * @property string|null $default_mode Стартовый режим: ulove|upin. NULL — режим не выбран, показать модалку.
 * @property \Carbon\Carbon|null $default_mode_set_at Когда выбран стартовый режим.
 * @property string $account_type Тип аккаунта: person|business. business ведёт в кабинет компании.
 * @property string|null $dating_goal Цель анкеты ULove.
 * @property string|null $thought Короткая мысль под именем в профиле (до 140 символов).
 */
class User extends Authenticatable
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

    public function effectivePlan(): string
    {
        if ($this->isPlanExpired()) return 'free';
        return $this->plan ?? 'free';
    }

    protected static function booted(): void
    {
        static::creating(function (self $user) {
            if (! $user->is_invisible && ($user->is_admin || $user->role === 'admin')) {
                $user->is_invisible = true;
            }

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
            if (!$this->avatar_path) return null;
            return Storage::disk(self::avatarDisk())->url($this->avatar_path);
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

    public function isAdmin(): bool { return $this->is_admin || $this->role === 'admin'; }
    public function isBanned(): bool { return $this->banned_at !== null; }
    public function isModerator(): bool { return $this->isAdmin() || $this->role === 'moderator'; }
    public function hasRole(string $role): bool { return $this->role === $role || $this->isAdmin(); }

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
        if (in_array($this->effectivePlan(), ['pro','business'])) return true;
        return $this->livePinsCount() < self::FREE_PINS_LIMIT;
    }

    /**
     * Лимит своих UDistrict-районов по тарифу.
     *
     * Free — 2, Pro — 5, Business — 15, админ — безлимит (null).
     *
     * @return int|null максимум районов, null — безлимит
     */
    public function districtsLimit(): ?int
    {
        if ($this->isAdmin()) return null;
        return match ($this->effectivePlan()) {
            'business' => self::BUSINESS_DISTRICTS_LIMIT,
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
     * Free — 3 в месяц, pro/business/admin — безлимит.
     *
     * @return bool true когда лимит не исчерпан
     */
    public function canInviteToPin(): bool
    {
        if ($this->isAdmin()) return true;
        if (in_array($this->effectivePlan(), ['pro', 'business'])) return true;
        return $this->pinInvitesUsedThisMonth() < self::FREE_PIN_INVITES_MONTH_LIMIT;
    }

    public function pinTtlHours(): ?int
    {
        if ($this->isAdmin()) return null;
        if ($this->effectivePlan() === 'business') return null;
        if ($this->effectivePlan() === 'pro') return 12;
        return 4;
    }

    public function pinRadius(): int
    {
        if ($this->isAdmin()) return 500000;
        if ($this->effectivePlan() === 'business') return 50000;
        if ($this->effectivePlan() === 'pro') return 15000;
        return 10000;
    }

    public function homeRadiusLimit(): int
    {
        if ($this->isAdmin()) return 500;
        if ($this->effectivePlan() === 'business') return 50;
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

    public function isPro(): bool { return $this->isAdmin() || in_array($this->effectivePlan(), ['pro','business']); }

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
        if ($this->isBusinessAccount()) {
            return route('business.index', absolute: false);
        }

        if ($this->defaultMode() === 'upin') {
            return route('map', absolute: false);
        }

        return route('swipes', absolute: false);
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

    public function canUseIncognitoLike(): bool { return $this->isPro(); }

    public function canUseInvisible(): bool { return $this->isAdmin() || in_array($this->effectivePlan(), ['pro','business']); }

    public function hiddenFriendsLimit(): ?int
    {
        if ($this->isAdmin()) return null;
        return match ($this->effectivePlan()) {
            'business' => null,
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

    public function canShowExactHome(): bool { return $this->isAdmin() || in_array($this->effectivePlan(), ['pro', 'business']); }

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
     * Free даёт 5 бесплатных фото, Pro — 6, Business/админ — 15.
     *
     * @return int максимальное число фото
     */
    public function photoLimit(): int
    {
        if ($this->isAdmin()) return 15;
        return match ($this->effectivePlan()) {
            'business' => 15,
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
            'business' => 20,
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

    public function messageBlockReason(User $other): ?string
    {
        if ($this->id === $other->id) return 'Нельзя писать себе';
        if ($this->isAdmin()) return null;
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
        return !$this->is_hidden_from_search;
    }

    public static function hiddenFromSearchFor(User $viewer): array
    {
        if ($viewer->isAdmin()) return [];
        $ids = static::where('is_hidden_from_search', true)->where('id', '!=', $viewer->id)->pluck('id')->all();
        if (!self::isGhostSeer($viewer) && (int) $viewer->id !== self::GHOST_USER_ID) $ids[] = self::GHOST_USER_ID;
        return array_values(array_unique(array_map('intval', $ids)));
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
    public const AUTO_REPLY_DEFAULT = '👋 Привет! Я пока не онлайн, поэтому пообщаемся чуть позже. Я уже получил уведомление о твоём сообщении и обязательно отвечу!';

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
            'banned_at' => 'datetime',
            'pins_today_date' => 'date',
            'trial_ends_at' => 'datetime',
            'bio' => EncryptedTextCast::class,
            'thought' => EncryptedTextCast::class,
            'dating_about' => EncryptedTextCast::class,
            'dating_custom_goal' => EncryptedTextCast::class,
        ];
    }
}
