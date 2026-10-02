<?php

namespace App\Notifications;

use App\Models\Pin;
use App\Models\PinComment;
use App\Models\User;

/**
 * Реакция на комментарий пина (владельцу комментария).
 *
 * Раньше реакции на комменты не уведомляли вообще: ни колокольчик,
 * ни realtime, ни бот — лайк как будто пропадал. Тип общий с реакциями
 * пинов (`pin.reaction`, таб «Пины»), поэтому фронт (тосты, табы,
 * диплинки `/map?pin=&comment=`) работает без изменений.
 */
class PinCommentReactionNotification extends UserNotification
{
    public function __construct(
        private Pin $pin,
        private PinComment $comment,
        private User $actor,
        private string $reactionType,
        private int $ownerId,
    ) {}

    public function type(): string { return 'pin.reaction'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string
    {
        return "pin-comment-reaction:{$this->comment->id}:{$this->actor->id}:{$this->reactionType}";
    }

    /**
     * Пейлоад строки inbox.
     *
     * @param string $id uuid создаваемой строки
     * @return array{activity:array<string,mixed>}
     */
    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'reaction', $this->ownerId, [
                'pin_id' => $this->pin->id,
                'actor_id' => $this->actor->id,
                'comment_id' => $this->comment->id,
                'reaction_type' => $this->reactionType,
                'excerpt' => static::excerpt($this->comment->content),
                'pin' => ['id' => $this->pin->id, 'title' => $this->pin->title, 'category' => $this->pin->category],
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    /**
     * Системный web-push.
     *
     * @return array{title:string,body:string,url:string,tag:string,avatar:string|null}
     */
    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';
        $title = mb_strimwidth($this->pin->title ?: 'Пин', 0, 40, '…');
        $emoji = ['like' => '❤️', 'fire' => '🔥', 'laugh' => '😂', 'sad' => '😢', 'angry' => '😡', 'useful' => '👍'][$this->reactionType] ?? '⭐';

        return [
            'title' => 'Активность пина',
            'body' => "{$name} {$emoji} комментарий в «{$title}»",
            'url' => '/map?pin='.$this->pin->id.'&comment='.$this->comment->id,
            'tag' => "pin-{$this->pin->id}-comment-{$this->comment->id}-reaction-{$this->actor->id}-{$this->reactionType}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
