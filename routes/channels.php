<?php

use App\Models\Conversation;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('chat.{conversationId}', function ($user, $conversationId) {
    $conv = Conversation::find($conversationId);
    if (!$conv) return false;
    return $conv->hasParticipant($user->id);
});

Broadcast::channel('user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

Broadcast::channel('map', function () { return true; });

Broadcast::channel('threads.{kind}.{id}', function () { return true; });

Broadcast::channel('online', function ($user) {
    if ($user->isInvisibleActive()) return false;
    return ['id' => $user->id, 'name' => $user->name, 'avatar_path' => $user->avatar_path, 'telegram_photo_url' => $user->telegram_photo_url, 'avatar_url' => $user->avatar_url];
});
