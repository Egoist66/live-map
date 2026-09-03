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

#[Fillable(['name', 'email', 'password', 'plan', 'latitude', 'longitude', 'role', 'is_admin', 'avatar_path', 'home_lat', 'home_lng', 'home_radius_km', 'bio', 'reputation_score', 'level', 'is_anonymous_default', 'message_privacy', 'allow_random_messages', 'settings', 'last_seen_at', 'is_invisible', 'plan_expires_at', 'pins_today_count', 'pins_today_date', 'stripe_id', 'pm_type', 'pm_last_four', 'trial_ends_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $appends = ['avatar_url'];

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

    public function isAdmin(): bool { return $this->is_admin || $this->role === 'admin'; }
    public function isModerator(): bool { return $this->isAdmin() || $this->role === 'moderator'; }
    public function hasRole(string $role): bool { return $this->role === $role || $this->isAdmin(); }

    public function canCreatePin(): bool
    {
        if ($this->isAdmin()) return true;
        if (in_array($this->plan, ['pro','business'])) return true;
        if ($this->pins_today_date?->toDateString() !== now()->toDateString()) return true;
        return $this->pins_today_count < 3;
    }

    public function pinTtlHours(): int
    {
        if ($this->isAdmin()) return 168;
        return $this->plan === 'free' ? 2 : 24;
    }

    public function pinRadius(): int
    {
        if ($this->isAdmin()) return 50000;
        return $this->plan === 'free' ? 1000 : 5000;
    }

    public function isPro(): bool { return $this->isAdmin() || in_array($this->plan, ['pro','business']); }

    public function canUseInvisible(): bool { return $this->isAdmin() || in_array($this->plan, ['pro','business']); }

    public function isInvisibleActive(): bool { return (bool) $this->is_invisible && $this->canUseInvisible(); }

    public function canModerate(): bool { return $this->isModerator(); }

    public function canDeletePin(Pin $pin): bool { return $this->isAdmin() || $pin->user_id === $this->id; }

    public function canManageBusiness(?Business $business = null): bool
    {
        if ($this->isAdmin()) return true;
        if (!$business) return $this->plan === 'business' || $this->isPro();
        return $this->id === $business->user_id || $this->isAdmin();
    }

    public function canMessageUser(User $other): bool { return $this->messageBlockReason($other) === null; }

    public function messageBlockReason(User $other): ?string
    {
        if ($this->id === $other->id) return 'Нельзя писать себе';
        if (UserBlock::where('blocker_id', $other->id)->where('blocked_id', $this->id)->exists()) return 'Пользователь заблокировал вас';
        if (UserBlock::where('blocker_id', $this->id)->where('blocked_id', $other->id)->exists()) return 'Вы заблокировали пользователя';
        if ($other->message_privacy === 'none') return 'Пользователь закрыл личные сообщения';
        if ($other->message_privacy === 'friends' && !Friendship::areFriends($this->id, $other->id)) return 'Только друзья могут писать этому пользователю';
        if (!$other->allow_random_messages && !Friendship::areFriends($this->id, $other->id)) return 'Пользователь принимает сообщения только от друзей';
        return null;
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
            'settings' => 'array',
            'is_anonymous_default' => 'boolean',
            'allow_random_messages' => 'boolean',
            'is_admin' => 'boolean',
            'is_invisible' => 'boolean',
            'last_seen_at' => 'datetime',
            'plan_expires_at' => 'datetime',
            'pins_today_date' => 'date',
            'trial_ends_at' => 'datetime',
        ];
    }
}
