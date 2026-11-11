<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Новая подписка на Pipe-ленту автора (pipe.ulove.by).
 *
 * Анонимности нет: профиль подписчика открыт (pipe.profile),
 * получатель видит «X читает ваши треды» и может подписаться обратно.
 */
class PipeFollowedNotification extends UserNotification
{
    /**
     * @param User $target автор (получатель)
     * @param User $follower новый читатель
     * @param int $ownerId получатель (target id)
     */
    public function __construct(
        private User $target,
        private User $follower,
        private int $ownerId,
    ) {}

    public function type(): string
    {
        return 'pipe.followed';
    }

    public function category(): string
    {
        return 'event';
    }

    public function dedupeKey(): ?string
    {
        return "pipe-follow:{$this->follower->id}:{$this->target->id}";
    }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'pipe_follow', $this->ownerId, [
                'related_user_id' => $this->follower->id,
                'actor' => static::actorShape($this->follower),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Новый читатель в Pipe',
            'body' => ($this->follower->name ?: 'Кто-то').' подписался на ваши треды',
            'url' => self::pipeProfileUrl((int) $this->follower->id),
            'tag' => "pipe-follow:{$this->follower->id}",
            'avatar' => $this->follower->avatar_url,
        ];
    }
}
