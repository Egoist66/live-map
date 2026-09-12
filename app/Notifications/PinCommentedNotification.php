<?php

namespace App\Notifications;

use App\Models\Pin;
use App\Models\PinComment;
use App\Models\User;

/**
 * Комментарий к пину (владельцу пина).
 */
class PinCommentedNotification extends UserNotification
{
    public function __construct(
        private Pin $pin,
        private User $actor,
        private PinComment $comment,
        private int $ownerId,
    ) {}

    public function type(): string { return 'pin.commented'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string { return 'pin-comment:'.$this->comment->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'comment', $this->ownerId, [
                'pin_id' => $this->pin->id,
                'actor_id' => $this->actor->id,
                'comment_id' => $this->comment->id,
                'excerpt' => static::excerpt($this->comment->content),
                'pin' => ['id' => $this->pin->id, 'title' => $this->pin->title, 'category' => $this->pin->category],
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';
        $title = mb_strimwidth($this->pin->title ?: 'Пин', 0, 40, '…');
        $excerpt = static::excerpt($this->comment->content);

        return [
            'title' => 'Активность пина',
            'body' => $excerpt ? "{$name}: {$excerpt}" : "{$name} комментирует «{$title}»",
            'url' => '/map?pin='.$this->pin->id.'&comment='.$this->comment->id,
            'tag' => "pin-{$this->pin->id}-comment-{$this->comment->id}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
