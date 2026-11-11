<?php

namespace App\Notifications;

use App\Models\PipeReply;
use App\Models\PipeThread;
use App\Models\User;

/**
 * Лайк треда или ответа в Pipe (pipe.ulove.by).
 *
 * Анонимные лайки не отправляются с авторством: activity идёт
 * с is_incognito и anonym-actor'ом «Кто-то».
 */
class PipeLikedNotification extends UserNotification
{
    /**
     * @param PipeThread|PipeReply $target лайкнутая сущность
     * @param User $actor кто лайкнул
     * @param int $ownerId получатель (id автора target)
     */
    public function __construct(
        private PipeThread|PipeReply $target,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string
    {
        return 'pipe.liked';
    }

    public function category(): string
    {
        return 'event';
    }

    public function dedupeKey(): ?string
    {
        $kind = $this->target instanceof PipeThread ? 'thread' : 'reply';

        return "pipe-like:{$kind}:{$this->target->id}:{$this->actor->id}";
    }

    public function payload(string $id): array
    {
        $target = $this->target;
        $isAnonymous = (bool) $target->is_anonymous;
        $thread = $target instanceof PipeThread ? $target : null;

        return [
            'activity' => static::activityShape($id, 'pipe_like', $this->ownerId, [
                'pipe_thread_id' => $this->pipeThreadId($target),
                'pipe_thread' => static::pipeThreadShape($thread ?? $target),
                'excerpt' => self::excerpt($target->body),
                'count' => max(0, (int) $target->likes_count),
                'related_user_id' => $isAnonymous ? null : $this->actor->id,
                'is_incognito' => $isAnonymous,
                'actor' => $isAnonymous
                    ? ['id' => null, 'name' => 'Кто-то', 'avatar_path' => null, 'avatar_url' => null]
                    : static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $target = $this->target;

        return [
            'title' => 'Новый лайк в Pipe',
            'body' => 'Кто-то оценил '.($target instanceof PipeThread ? 'ваш тред' : 'ваш ответ'),
            'url' => route('pipe.show', ['thread' => $this->pipeThreadId($target)]),
            'tag' => "pipe-like:{$target->id}:{$this->actor->id}",
            'avatar' => $target->is_anonymous ? null : $this->actor->avatar_url,
        ];
    }

    /**
     * Id треда лайкнутой сущности (для диплинка).
     *
     * @param PipeThread|PipeReply $target лайкнутая сущность
     */
    private function pipeThreadId(PipeThread|PipeReply $target): int
    {
        return $target instanceof PipeThread ? (int) $target->id : (int) $target->thread_id;
    }
}
