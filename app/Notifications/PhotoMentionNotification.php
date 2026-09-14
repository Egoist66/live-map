<?php

namespace App\Notifications;

use App\Models\ProfilePhoto;
use App\Models\ProfilePhotoComment;
use App\Models\User;

/**
 * Упоминание через @ в комментарии к фото.
 */
class PhotoMentionNotification extends UserNotification
{
    public function __construct(
        private ProfilePhoto $photo,
        private User $actor,
        private ProfilePhotoComment $comment,
        private int $ownerId,
    ) {}

    public function type(): string { return 'photo.mention'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'photo-mention:'.$this->comment->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'mention', $this->ownerId, [
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
            'title' => 'Вас упомянули',
            'body' => $excerpt ? "{$name} упомянул вас: {$excerpt}" : "{$name} упомянул вас в комментарии к фото",
            'url' => '/users/'.$this->photo->user_id.'?photo='.$this->photo->id.'&comment='.$this->comment->id,
            'tag' => "photo-{$this->photo->id}-mention-{$this->comment->id}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
