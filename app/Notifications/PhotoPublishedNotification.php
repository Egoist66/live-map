<?php

namespace App\Notifications;

use App\Models\ProfilePhoto;
use App\Models\User;

/**
 * Пользователь загрузил фото (подписчикам с флагом notify_photo).
 */
class PhotoPublishedNotification extends UserNotification
{
    public function __construct(
        private ProfilePhoto $photo,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'photo.published'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'photo-published:'.$this->photo->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'sub_photo', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'photo_id' => $this->photo->id,
                'photo' => static::photoShape($this->photo),
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Новое фото',
            'body' => $this->actor->name.' — новое фото',
            'url' => '/users/'.$this->actor->id,
            'tag' => 'photo-published-'.$this->photo->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
