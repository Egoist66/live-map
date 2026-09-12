<?php

namespace App\Notifications;

use App\Models\Pin;
use App\Models\User;

/**
 * Реакция на пин (владельцу пина).
 */
class PinReactionNotification extends UserNotification
{
    public function __construct(
        private Pin $pin,
        private User $actor,
        private string $reactionType,
        private int $ownerId,
    ) {}

    public function type(): string { return 'pin.reaction'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string
    {
        return "pin-reaction:{$this->pin->id}:{$this->actor->id}:{$this->reactionType}";
    }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'reaction', $this->ownerId, [
                'pin_id' => $this->pin->id,
                'actor_id' => $this->actor->id,
                'reaction_type' => $this->reactionType,
                'pin' => ['id' => $this->pin->id, 'title' => $this->pin->title, 'category' => $this->pin->category],
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $name = $this->actor->name ?: 'Кто-то';
        $title = mb_strimwidth($this->pin->title ?: 'Пин', 0, 40, '…');
        $emoji = ['like' => '❤️', 'fire' => '🔥', 'laugh' => '😂', 'sad' => '😢', 'angry' => '😡', 'useful' => '👍'][$this->reactionType] ?? '⭐';

        return [
            'title' => 'Активность пина',
            'body' => "{$name} {$emoji} «{$title}»",
            'url' => '/map?pin='.$this->pin->id,
            'tag' => "pin-{$this->pin->id}-reaction-{$this->actor->id}-{$this->reactionType}",
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
