<?php


namespace App\Policies;

use App\Models\PinComment;
use App\Models\User;

class CommentPolicy
{
    public function delete(User $user, PinComment $comment): bool
    {
        return $user->isAdmin() || $user->id === $comment->user_id;
    }
    public function update(User $user, PinComment $comment): bool
    {
        return $user->isAdmin() || $user->id === $comment->user_id;
    }
}
