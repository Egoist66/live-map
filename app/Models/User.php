<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Storage;

#[Fillable(['name', 'email', 'password', 'gender', 'plan', 'latitude', 'longitude', 'role', 'is_admin', 'is_hidden_from_search', 'avatar_path', 'home_lat', 'home_lng', 'home_city', 'home_address', 'home_visibility', 'home_show_exact', 'home_radius_km', 'bio', 'reputation_score', 'level', 'is_anonymous_default', 'default_location_precision', 'default_blur_meters', 'message_privacy', 'allow_random_messages', 'settings', 'last_seen_at', 'is_invisible', 'screen_lock_code', 'screen_lock_timeout', 'screen_lock_kind', 'plan_expires_at', 'pins_today_count', 'pins_today_date', 'stripe_id', 'pm_type', 'pm_last_four', 'trial_ends_at'])]
#[Hidden(['password', 'remember_token', 'screen_lock_code'])]
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $appends = ['avatar_url'];

    protected static function booted(): void
    {
        static::creating(function (self $user) {
            if (! $user->is_invisible && ($user->is_admin || $user->role === 'admin')) {
                $user->is_invisible = true;
            }
        });

        static::updating(function (self $user) {
            if (($user->isDirty('is_admin') || $user->isDirty('role')) && $user->isAdmin() && ! $user->is_invisible) {
                $user->is_invisible = true;
            }
        });
    }

    protected function avatarUrl(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (!$this->avatar_path) return null;
            $disk = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket') ? 's3' : 'public';
            return Storage::disk($disk)->url($this->avatar_path);
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

    public function isAdmin(): bool { return $this->is_admin || $this->role === 'admin'; }
    public function isModerator(): bool { return $this->isAdmin() || $this->role === 'moderator'; }
    public function hasRole(string $role): bool { return $this->role === $role || $this->isAdmin(); }

    public const FREE_PINS_LIMIT = 3;

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
        if (in_array($this->plan, ['pro','business'])) return true;
        return $this->livePinsCount() < self::FREE_PINS_LIMIT;
    }

    public function pinTtlHours(): ?int
    {
        if ($this->isAdmin()) return null;
        if ($this->plan === 'business') return null;
        if ($this->plan === 'pro') return 12;
        return 4;
    }

    public function pinRadius(): int
    {
        if ($this->isAdmin()) return 500000;
        if ($this->plan === 'business') return 50000;
        if ($this->plan === 'pro') return 15000;
        return 5000;
    }

    public function homeRadiusLimit(): int
    {
        if ($this->isAdmin()) return 500;
        if ($this->plan === 'business') return 50;
        if ($this->plan === 'pro') return 15;
        return 5;
    }

    public function isPro(): bool { return $this->isAdmin() || in_array($this->plan, ['pro','business']); }

    public function canUseInvisible(): bool { return $this->isAdmin() || in_array($this->plan, ['pro','business']); }

    public function hiddenFriendsLimit(): ?int
    {
        if ($this->isAdmin()) return null;
        return match ($this->plan) {
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

    public function canShowExactHome(): bool { return $this->isAdmin() || in_array($this->plan, ['pro', 'business']); }

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

    public function canDeletePin(Pin $pin): bool { return $this->isAdmin() || $pin->user_id === $this->id; }

    public function canManageBusiness(?Business $business = null): bool
    {
        if ($this->isAdmin()) return true;
        if (!$business) return $this->plan === 'business' || $this->isPro();
        return $this->id === $business->user_id || $this->isAdmin();
    }

    public function canMessageUser(User $other): bool { return $this->messageBlockReason($other) === null; }

    public static function isAdminFriendship(User $a, User $b): bool
    {
        if ($a->isAdmin()) return true;
        if ($b->isAdmin()) return true;
        return static::whereKey($b->id)->where(function ($q) {
            $q->where('is_admin', true)->orWhere('role', 'admin');
        })->exists();
    }

    public function messageBlockReason(User $other): ?string
    {
        if ($this->id === $other->id) return 'Нельзя писать себе';
        if (UserBlock::where('blocker_id', $other->id)->where('blocked_id', $this->id)->exists()) return 'Пользователь заблокировал вас';
        if (UserBlock::where('blocker_id', $this->id)->where('blocked_id', $other->id)->exists()) return 'Вы заблокировали пользователя';
        if (Friendship::areFriends($this->id, $other->id) && self::isAdminFriendship($this, $other)) return null;
        if ($other->message_privacy === 'none') return 'Пользователь закрыл личные сообщения';
        if ($other->message_privacy === 'friends' && !Friendship::areFriends($this->id, $other->id)) return 'Только друзья могут писать этому пользователю';
        if (!$other->allow_random_messages && !Friendship::areFriends($this->id, $other->id)) return 'Пользователь принимает сообщения только от друзей';
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

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'home_lat' => 'decimal:7',
            'home_lng' => 'decimal:7',
            'home_show_exact' => 'boolean',
            'settings' => 'array',
            'is_anonymous_default' => 'boolean',
            'allow_random_messages' => 'boolean',
            'is_admin' => 'boolean',
            'is_hidden_from_search' => 'boolean',
            'is_invisible' => 'boolean',
            'last_seen_at' => 'datetime',
            'plan_expires_at' => 'datetime',
            'pins_today_date' => 'date',
            'trial_ends_at' => 'datetime',
        ];
    }
}
