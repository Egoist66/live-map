<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Builder;

class Pin extends Model
{
    public const BUILT_IN_CATEGORIES = [
        'sos', 'question', 'announcement', 'warning', 'event', 'offer', 'help',
        'sport', 'food', 'music', 'pets', 'sale', 'job',
        'study', 'travel', 'tech', 'health', 'art', 'humor', 'rest',
    ];

    /**
     * Категория экстренных ситуаций: требует явного подтверждения ответственности.
     */
    public const SOS_CATEGORY = 'sos';

    /**
     * Лимит SOS-пинов в месяц для Free.
     */
    public const SOS_FREE_MONTH_LIMIT = 1;

    /**
     * Лимит SOS-пинов в месяц для Pro/Business.
     */
    public const SOS_PRO_MONTH_LIMIT = 3;

    /**
     * Проверить, относится ли значение к SOS-категории.
     *
     * @param string|null $v сырое значение категории
     * @return bool true для SOS
     */
    public static function isSosCategory(?string $v): bool
    {
        return self::normalizeCategory($v) === self::SOS_CATEGORY;
    }

    public static function normalizeCategory(?string $v): string
    {
        return mb_strtolower(trim((string) $v));
    }

    public static function canUseCategory(User $user, string $category): bool
    {
        if (in_array($category, self::BUILT_IN_CATEGORIES, true)) return true;
        return $user->isPro() || $user->isAdmin();
    }

    protected $fillable = [
        'user_id','district_id','title','body','promo','category','gender_audience','latitude','longitude','real_lat','real_lng','location_precision',
        'radius_meters','visibility_radius_km','expires_at','publish_at','status','priority','is_pinned','is_sponsored','is_boosted','boosted_until','views_count','likes_count','reactions_count','comments_count','is_anonymous','district_name','country','country_code','photo_path','meta'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'publish_at' => 'datetime',
        'boosted_until' => 'datetime',
        'meta' => 'array',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'real_lat' => 'decimal:7',
        'real_lng' => 'decimal:7',
        'is_anonymous' => 'boolean',
        'is_pinned' => 'boolean',
        'is_sponsored' => 'boolean',
        'is_boosted' => 'boolean',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }

    /**
     * Район пина: null — обычный пин, иначе виден только жителям района.
     */
    public function district(): BelongsTo { return $this->belongsTo(District::class); }

    /**
     * SOS-вызов этого пина (только для категории SOS).
     */
    public function sosCall(): HasOne { return $this->hasOne(SosCall::class); }
    public function boosts(): HasMany { return $this->hasMany(PinBoost::class); }
    public function views(): HasMany { return $this->hasMany(PinView::class); }
    public function comments(): HasMany { return $this->hasMany(PinComment::class); }
    public function reactions() { return $this->morphMany(Reaction::class, 'reactable'); }
    public function invites(): HasMany { return $this->hasMany(PinInvite::class); }

    /**
     * Приглашён ли пользователь смотреть пин вне зоны/страны.
     */
    public function isInvited(?int $userId): bool
    {
        if (!$userId) return false;
        return $this->invites()->where('invitee_id', $userId)->exists()
            || PinInvite::where('pin_id', $this->id)->where('invitee_id', $userId)->exists();
    }

    public function scopeActive(Builder $q): Builder { return $q->where('status', 'active')->where(fn($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>', now()))->where(fn($w) => $w->whereNull('publish_at')->orWhere('publish_at', '<=', now())); }
    public function scopeScheduled(Builder $q): Builder { return $q->where('status', 'scheduled')->where('publish_at', '>', now()); }
    public function scopeArchivedOnly(Builder $q): Builder { return $q->whereIn('status', ['expired', 'archived'])->orWhere(fn($w) => $w->whereNotNull('expires_at')->where('expires_at', '<=', now())); }
    public function scopeNearby(Builder $q, float $lat, float $lng, int $radiusKm = 5): Builder
    {
        $haversine = "(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))";
        return $q->selectRaw("pins.*, $haversine as distance", [$lat, $lng, $lat])->having('distance', '<=', $radiusKm)->orderBy('distance');
    }
    public function scopeBoostedFirst(Builder $q): Builder { return $q->orderByDesc('is_boosted')->orderByDesc('is_pinned')->orderByDesc('created_at'); }

    public const GENDER_AUDIENCES = ['all', 'male', 'female'];

    public static function normalizeGenderAudience(?string $v): string
    {
        $v = mb_strtolower(trim((string) $v));
        return in_array($v, ['male', 'female'], true) ? $v : 'all';
    }

    public function scopeVisibleForGender(Builder $q, ?User $viewer): Builder
    {
        if ($viewer && $viewer->isAdmin()) return $q;
        $viewerId = $viewer?->id;
        $gender = $viewer?->gender;
        return $q->where(function (Builder $w) use ($viewerId, $gender) {
            $w->where('gender_audience', 'all')->orWhereNull('gender_audience');
            if (in_array($gender, ['male', 'female'], true)) {
                $w->orWhere('gender_audience', $gender);
            }
            if ($viewerId) {
                $w->orWhere('user_id', $viewerId);
            }
        });
    }

    public function isVisibleForGender(?User $viewer): bool
    {
        if ($viewer && ($viewer->isAdmin() || $viewer->id === $this->user_id)) return true;
        $audience = static::normalizeGenderAudience($this->gender_audience ?? 'all');
        if ($audience === 'all') return true;
        if (!$viewer) return false;
        return $viewer->gender === $audience;
    }

    public function isExpired(): bool { return $this->expires_at ? $this->expires_at->isPast() : false; }
    public function isVisibleForTier(string $plan): bool {
        $radius = $plan === 'business' ? 50000 : ($plan === 'pro' ? 15000 : 10000);
        return $this->radius_meters <= $radius;
    }

    public static function blurCoords(float $lat, float $lng, int $meters = 200): array
    {
        $r = $meters / 111300;
        $u = mt_rand() / mt_getrandmax();
        $v = mt_rand() / mt_getrandmax();
        $w = $r * sqrt($u);
        $t = 2 * M_PI * $v;
        $dx = $w * cos($t);
        $dy = $w * sin($t);
        $newLat = $lat + $dy;
        $newLng = $lng + $dx / cos(deg2rad($lat));
        return [round($newLat, 7), round($newLng, 7)];
    }

    public static function blurMetersFor(?string $precision, $meta = null): int
    {
        if ($precision === 'exact') return 0;
        if ($precision === 'district') return 1200;
        if ($precision === 'custom') return max(0, (int) (is_array($meta) ? ($meta['blur_meters'] ?? 200) : 200));
        return 200;
    }

    public static function blurHintFor(?string $precision, $meta = null): ?string
    {
        $meters = static::blurMetersFor($precision, $meta);
        if ($meters <= 0 || $precision === 'exact') return null;
        return 'Виртуальная точка · сдвинута примерно на ' . static::formatMeters($meters) . ' — это не точное местоположение';
    }

    public static function formatMeters(int $meters): string
    {
        if ($meters >= 1000) {
            $km = $meters / 1000;
            $str = rtrim(rtrim(number_format($km, 1, ',', ' '), '0'), ',');
            return $str . ' км';
        }
        return $meters . ' м';
    }

    public function toPublicArray(?int $viewerId = null, bool $isInvited = false): array
    {
        $isOwner = $viewerId && $this->user_id === $viewerId;
        $meta = is_array($this->meta) ? $this->meta : (is_string($this->meta) ? json_decode($this->meta, true) : []);
        $blurMeters = static::blurMetersFor($this->location_precision, $meta);
        $owner = $this->relationLoaded('user') ? $this->user : null;
        $isBusiness = $owner ? (string) ($owner->account_type ?? 'person') === 'business' : false;
        return [
            'id' => $this->id,
            'district_id' => $this->district_id ? (int) $this->district_id : null,
            'title' => $this->title,
            'body' => $this->body,
            'promo' => $this->promo ?? null,
            'is_business' => $isBusiness,
            'category' => $this->category,
            'gender_audience' => static::normalizeGenderAudience($this->gender_audience ?? 'all'),
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'expires_at' => $this->expires_at,
            'publish_at' => $this->publish_at,
            'status' => $this->status,
            'is_scheduled' => $this->status === 'scheduled',
            'is_boosted' => (bool) $this->is_boosted,
            'is_sponsored' => (bool) $this->is_sponsored,
            'priority' => $this->priority,
            'views_count' => $this->views_count,
            'likes_count' => $this->likes_count,
            'reactions_count' => $this->reactions_count,
            'comments_count' => $this->comments_count,
            'is_anonymous' => (bool) $this->is_anonymous,
            'is_owner' => $isOwner,
            'is_invited' => $isInvited,
            'country' => $this->country ?? null,
            'country_code' => $this->country_code ?? null,
            'location_precision' => $this->location_precision,
            'is_blurred' => $this->location_precision !== 'exact' && $blurMeters > 0,
            'blur_meters' => $blurMeters,
            'blur_label' => $blurMeters > 0 ? static::formatMeters($blurMeters) : null,
            'blur_hint' => static::blurHintFor($this->location_precision, $meta),
            'user' => $this->is_anonymous && !$isOwner ? null : ($this->user ? array_merge($this->user->only(['id', 'name', 'profile_slug', 'avatar_path', 'level']), ['avatar_url' => $this->user->avatar_url]) : null),
            'created_at' => $this->created_at,
        ];
    }
}
