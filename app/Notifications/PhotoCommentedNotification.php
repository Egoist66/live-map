<?php

namespace App\Notifications;

use App\Models\ProfilePhoto;
use App\Models\ProfilePhotoComment;
use App\Models\User;

/**
 * Комментарий к фото профиля (владельцу фото).
 */
class PhotoCommentedNotification extends UserNotification
{
    public function __construct(
        private ProfilePhoto $photo,
        private User $actor,
        private ProfilePhotoComment $comment,
        private int $ownerId,
    ) {}

    public function type(): string { return 'photo.commented'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string { return 'photo-comment:'.$this->comment->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'photo_comment', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'photo_id' => $this->photo->id,
                'photo_comment_id' => $this->comment->id,
                'excerpt' => static::excerpt($this->comment->content),
                'photo' => ['id' => $this->photo->id, 'user_id' => $this->photo->user_id, 'caption' => $this->photo->caption],
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';
        $excerpt = static::excerpt($this->comment->content);

        return [
            'title' => 'Комментарий к фото',
            'body' => $excerpt ? "{$name}: {$excerpt}" : "{$name} прокомментировал ваше фото",
            'url' => '/users/'.$this->photo->user_id.'?photo='.$this->photo->id.'&comment='.$this->comment->id,
            'tag' => "photo-{$this->photo->id}-comment-{$this->comment->id}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
