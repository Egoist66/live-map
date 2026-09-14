<?php

namespace App\Notifications;

use App\Models\ProfilePhoto;
use App\Models\User;

/**
 * Лайк фото профиля (владельцу фото).
 */
class PhotoLikedNotification extends UserNotification
{
    public function __construct(
        private ProfilePhoto $photo,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'photo.liked'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string
    {
        return "photo-like:{$this->photo->id}:{$this->actor->id}";
    }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'photo_like', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'photo_id' => $this->photo->id,
                'related_user_id' => $this->actor->id,
                'photo' => ['id' => $this->photo->id, 'user_id' => $this->photo->user_id, 'caption' => $this->photo->caption],
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';

        return [
            'title' => 'Лайк фото',
            'body' => "{$name} лайкнул ваше фото",
            'url' => '/users/'.$this->photo->user_id.'?photo='.$this->photo->id,
            'tag' => "photo-{$this->photo->id}-like-{$this->actor->id}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
