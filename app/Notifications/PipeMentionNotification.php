<?php

namespace App\Notifications;

use App\Models\PipeReply;
use App\Models\PipeThread;
use App\Models\User;

/**
 * Упоминание @ник в Pipe (тексте треда или ответа).
 *
 * Отправляется упомянутому пользователю: не автору поста/ответа
 * (они уже получили pipe_reply), не самому актору, не в блокировках.
 * Анонимные посты не раскрывают автора: actor маскируется.
 */
class PipeMentionNotification extends UserNotification
{
    /**
     * @param PipeThread $thread тред, где произошло упоминание
     * @param PipeReply|null $reply ответ с упоминанием (null — упоминание в теле треда)
     * @param string $excerpt короткий анонс текста с упоминанием
     * @param User $actor автор поста с упоминанием
     * @param int $ownerId получатель (упомянутый пользователь)
     */
    public function __construct(
        private PipeThread $thread,
        private ?PipeReply $reply,
        private string $excerpt,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string
    {
        return 'pipe.mention';
    }

    public function category(): string
    {
        return 'event';
    }

    public function dedupeKey(): ?string
    {
        $contextId = $this->reply ? (int) $this->reply->id : (int) $this->thread->id;

        return "pipe-mention:{$contextId}:{$this->ownerId}";
    }

    public function payload(string $id): array
    {
        $isAnonymous = (bool) ($this->reply?->is_anonymous ?? $this->thread->is_anonymous);

        return [
            'activity' => static::activityShape($id, 'pipe_mention', $this->ownerId, [
                'pipe_thread_id' => (int) $this->thread->id,
                'pipe_thread' => static::pipeThreadShape($this->thread),
                'excerpt' => $this->excerpt,
                'related_user_id' => $isAnonymous ? null : $this->actor->id,
                'is_incognito' => $isAnonymous,
                'actor' => $isAnonymous
                    ? null
                    : static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $isAnonymous = (bool) ($this->reply?->is_anonymous ?? $this->thread->is_anonymous);

        return [
            'title' => $isAnonymous ? 'Вас упомянули в Pipe' : "{$this->actor->name} упомянул вас в Pipe",
            'body' => mb_substr((string) ($this->excerpt ?: 'Откройте тред, чтобы прочитать'), 0, 120),
            'url' => self::pipeThreadUrl((int) $this->thread->id),
            'tag' => 'pipe-mention-'.($this->reply ? 'reply-'.$this->reply->id : 'thread-'.$this->thread->id).'-'.$this->ownerId,
            'avatar' => $isAnonymous ? null : $this->actor->avatar_url,
        ];
    }
}
