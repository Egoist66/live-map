<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class Pin extends Model
{
    protected $fillable = [
        'user_id','title','body','category','latitude','longitude','real_lat','real_lng','location_precision',
        'radius_meters','visibility_radius_km','expires_at','status','priority','is_pinned','is_sponsored','is_boosted','boosted_until','views_count','likes_count','reactions_count','comments_count','is_anonymous','district_name','photo_path','meta'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
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
    public function boosts(): HasMany { return $this->hasMany(PinBoost::class); }
    public function views(): HasMany { return $this->hasMany(PinView::class); }
    public function comments(): HasMany { return $this->hasMany(PinComment::class); }
    public function reactions() { return $this->morphMany(Reaction::class, 'reactable'); }

    public function scopeActive(Builder $q): Builder { return $q->where('expires_at', '>', now()); }
    public function scopeNearby(Builder $q, float $lat, float $lng, int $radiusKm = 5): Builder
    {
        $haversine = "(6371 * acos(cos(radians(?)) * cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * sin(radians(latitude))))";
        return $q->selectRaw("pins.*, $haversine as distance", [$lat, $lng, $lat])->having('distance', '<=', $radiusKm)->orderBy('distance');
    }
    public function scopeBoostedFirst(Builder $q): Builder { return $q->orderByDesc('is_boosted')->orderByDesc('is_pinned')->orderByDesc('created_at'); }

    public function isExpired(): bool { return $this->expires_at->isPast(); }
    public function isVisibleForTier(string $plan): bool {
        $radius = $plan === 'business' ? 5000 : ($plan === 'pro' ? 5000 : 1000);
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

    public function toPublicArray(?int $viewerId = null): array
    {
        $isOwner = $viewerId && $this->user_id === $viewerId;
        return [
            'id' => $this->id,
            'title' => $this->title,
            'body' => $this->body,
            'category' => $this->category,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'expires_at' => $this->expires_at,
            'is_boosted' => (bool) $this->is_boosted,
            'is_sponsored' => (bool) $this->is_sponsored,
            'priority' => $this->priority,
            'views_count' => $this->views_count,
            'likes_count' => $this->likes_count,
            'reactions_count' => $this->reactions_count,
            'comments_count' => $this->comments_count,
            'is_anonymous' => (bool) $this->is_anonymous,
            'user' => $this->is_anonymous && !$isOwner ? null : $this->user?->only(['id', 'name', 'avatar_path', 'level']),
            'created_at' => $this->created_at,
        ];
    }
}
