<?php

namespace App\Notifications;

use App\Models\ProfilePhoto;
use App\Models\ProfilePhotoComment;
use App\Models\User;

/**
 * Ответ на комментарий к фото (автору родительского коммента).
 */
class PhotoRepliedNotification extends UserNotification
{
    public function __construct(
        private ProfilePhoto $photo,
        private User $actor,
        private ProfilePhotoComment $comment,
        private int $ownerId,
    ) {}

    public function type(): string { return 'photo.replied'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'photo-replied:'.$this->comment->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'photo_reply', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'photo_id' => $this->photo->id,
                'photo_comment_id' => $this->comment->id,
                'excerpt' => static::excerpt($this->comment->content),
                'photo' => static::photoShape($this->photo),
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';
        $excerpt = static::excerpt($this->comment->content);

        return [
            'title' => 'Ответ на комментарий',
            'body' => $excerpt ? "{$name} ответил вам: {$excerpt}" : "{$name} ответил на ваш комментарий к фото",
            'url' => '/users/'.$this->photo->user_id.'?photo='.$this->photo->id.'&comment='.$this->comment->id,
            'tag' => "photo-{$this->photo->id}-replied-{$this->comment->id}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
