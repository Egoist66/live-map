<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Смена репутации/уровня пользователя (подписчикам с флагом notify_level).
 */
class LevelChangedNotification extends UserNotification
{
    public function __construct(
        private User $user,
        private int $ownerId,
        private string $excerpt,
    ) {}

    public function type(): string { return 'profile.level'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'level:'.$this->user->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'sub_level', $this->ownerId, [
                'actor_id' => $this->user->id,
                'excerpt' => $this->excerpt,
                'actor' => static::actorShape($this->user->fresh() ?? $this->user),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Обновление профиля',
            'body' => $this->user->name.' — '.$this->excerpt,
            'url' => '/users/'.$this->user->id,
            'tag' => 'level-'.$this->user->id,
            'avatar' => $this->user->avatar_url,
        ];
    }
}
