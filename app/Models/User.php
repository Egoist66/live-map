<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'password', 'plan', 'latitude', 'longitude', 'role', 'is_admin', 'avatar_path', 'home_lat', 'home_lng', 'home_radius_km', 'reputation_score', 'level', 'is_anonymous_default', 'settings', 'plan_expires_at', 'pins_today_count', 'pins_today_date', 'stripe_id', 'pm_type', 'pm_last_four', 'trial_ends_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    use HasFactory, Notifiable;

    public function pins() { return $this->hasMany(Pin::class); }
    public function comments() { return $this->hasMany(PinComment::class); }
    public function reactions() { return $this->hasMany(Reaction::class); }
    public function zoneSubscriptions() { return $this->hasMany(ZoneSubscription::class); }
    public function businesses() { return $this->hasMany(Business::class); }
    public function reports() { return $this->hasMany(Report::class, 'reporter_id'); }
    public function blocks() { return $this->hasMany(UserBlock::class, 'blocker_id'); }
    public function blockedBy() { return $this->hasMany(UserBlock::class, 'blocked_id'); }

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

    public function canModerate(): bool { return $this->isModerator(); }

    public function canDeletePin(Pin $pin): bool { return $this->isAdmin() || $pin->user_id === $this->id; }

    public function canManageBusiness(?Business $business = null): bool
    {
        if ($this->isAdmin()) return true;
        if (!$business) return $this->plan === 'business' || $this->isPro();
        return $this->id === $business->user_id || $this->isAdmin();
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
            'is_admin' => 'boolean',
            'plan_expires_at' => 'datetime',
            'pins_today_date' => 'date',
            'trial_ends_at' => 'datetime',
        ];
    }
}
