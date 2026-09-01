<?php

namespace App\Policies;

use App\Models\Pin;
use App\Models\User;

class PinPolicy
{
    public function delete(User $user, Pin $pin): bool
    {
        return $user->canDeletePin($pin);
    }

    public function update(User $user, Pin $pin): bool
    {
        return $user->isAdmin() || $user->id === $pin->user_id;
    }

    public function boost(User $user, Pin $pin): bool
    {
        return $user->isAdmin() || $user->id === $pin->user_id;
    }
}
