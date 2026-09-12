<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Взаимный мэтч в ULove (обоим участникам).
 */
class DatingMatchedNotification extends UserNotification
{
    public function __construct(
        private User $actor,
        private int $ownerId,
        private int $matchId,
    ) {}

    public function type(): string { return 'dating.matched'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'dating-match:'.$this->matchId; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'match', $this->ownerId, [
                'actor_id' => $this->actor->id,
                'related_user_id' => $this->actor->id,
                'excerpt' => 'match:'.$this->matchId,
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => '💞 Новый мэтч!',
            'body' => $this->actor->name.' тоже лайкнул тебя — чат открыт',
            'url' => '/swipes',
            'tag' => 'dating-match-'.$this->matchId,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
