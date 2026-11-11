<?php

namespace App\Notifications;

use App\Models\PipeReply;
use App\Models\PipeThread;
use App\Models\User;

/**
 * Ответ в треде Pipe (pipe.ulove.by) — автору треда или автору ответа.
 *
 * Пейлоад activity в формате PinActivity: kind pipe_reply, excerpt,
 * actor. Анонимные ответы не раскрывают автора: actor маскируется.
 */
class PipeThreadRepliedNotification extends UserNotification
{
    /**
     * @param PipeThread $thread тред
     * @param PipeReply $reply свежий ответ
     * @param User $actor автор ответа
     * @param int $ownerId получатель
     * @param bool $isNestedReply true — это ответ на ответ получателя
     */
    public function __construct(
        private PipeThread $thread,
        private PipeReply $reply,
        private User $actor,
        private int $ownerId,
        private bool $isNestedReply = false,
    ) {}

    public function type(): string
    {
        return $this->isNestedReply ? 'pipe.reply_reply' : 'pipe.replied';
    }

    public function category(): string
    {
        return 'event';
    }

    public function dedupeKey(): ?string
    {
        $prefix = $this->isNestedReply ? 'reply-reply' : 'reply';

        return "pipe-{$prefix}:{$this->reply->id}:{$this->actor->id}";
    }

    public function payload(string $id): array
    {
        $isAnonymous = (bool) $this->reply->is_anonymous;

        return [
            'activity' => static::activityShape($id, 'pipe_reply', $this->ownerId, [
                'pipe_thread_id' => $this->thread->id,
                'pipe_thread' => static::pipeThreadShape($this->thread),
                'excerpt' => self::excerpt($this->reply->body),
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
        $isNestedReply = $this->isNestedReply;
        $isAnonymous = (bool) $this->reply->is_anonymous;
        $preview = self::excerpt($this->reply->body, 90);

        $title = $isAnonymous
            ? 'Новый анонимный ответ в треде'
            : 'Ответ в треде'.($isNestedReply ? ' на ваш ответ' : '');

        if ($isAnonymous && $isNestedReply) {
            $title = 'Анонимный ответ на ваш ответ';
        }

        return [
            'title' => $title,
            'body' => mb_substr((string) ($preview ?? 'Откройте тред, чтобы прочитать'), 0, 120),
            'url' => self::pipeThreadUrl((int) $this->thread->id),
            'tag' => "pipe-reply-{$this->reply->id}-{$this->actor->id}",
            'avatar' => $isAnonymous ? null : $this->actor->avatar_url,
        ];
    }
}
