<?php

namespace App\Services;

use App\Models\PipeReply;
use App\Models\PipeThread;
use App\Models\User;
use App\Notifications\PipeFollowedNotification;
use App\Notifications\PipeLikedNotification;
use App\Notifications\PipeThreadRepliedNotification;
use App\Notifications\UserNotification;
use Illuminate\Support\Facades\Log;

/**
 * Уведомления Pipe (pipe.ulove.by): ответы, лайки, подписки.
 *
 * Пуш через UserNotifier (единая inbox-таблица notifications,
 * пользовательский realtime-канал и веб-пуш) — тот же путь, что у UFlow,
 * только kinds — pipe_*. Анонимные ответы в push не показывают имя.
 */
class PipeNotifier
{
    /**
     * Уведомить автора треда и автора родительского ответа.
     *
     * @param PipeThread $thread тред
     * @param PipeReply $reply свежий ответ
     * @param PipeReply|null $parent родительский ответ (null — ответ на тред)
     * @param User $actor автор ответа
     */
    public static function replied(PipeThread $thread, PipeReply $reply, ?PipeReply $parent, User $actor): void
    {
        try {
            $actorId = (int) $actor->id;
            $threadOwnerId = (int) $thread->user_id;
            $excerpt = self::excerpt($reply->body);

            if ($actorId !== $threadOwnerId) {
                $owner = User::find($threadOwnerId);

                if ($owner) {
                    UserNotifier::send($owner, new PipeThreadRepliedNotification($thread, $reply, $actor, $threadOwnerId));
                }
            }

            $parentAuthorId = $parent ? (int) $parent->user_id : 0;
            $replyToOther = $parent
                && $parentAuthorId !== $actorId
                && $parentAuthorId !== $threadOwnerId;

            if ($replyToOther) {
                $parentAuthor = User::find($parentAuthorId);

                if ($parentAuthor) {
                    UserNotifier::send($parentAuthor, new PipeThreadRepliedNotification($thread, $reply, $actor, $parentAuthorId, true));
                }
            }
        } catch (\Throwable $error) {
            Log::warning('pipe reply notify failed', ['error' => $error->getMessage()]);
        }
    }

    /**
     * Уведомить автора о лайке треда или ответа.
     *
     * @param PipeThread|PipeReply $target лайкнутая сущность
     * @param User $actor кто лайкнул
     */
    public static function liked(PipeThread|PipeReply $target, User $actor): void
    {
        try {
            $authorId = (int) $target->user_id;
            $actorId = (int) $actor->id;

            if ($authorId === $actorId) {
                return;
            }

            $author = User::find($authorId);

            if ($author) {
                UserNotifier::send($author, new PipeLikedNotification($target, $actor, $authorId));
            }
        } catch (\Throwable $error) {
            Log::warning('pipe like notify failed', ['error' => $error->getMessage()]);
        }
    }

    /**
     * Убрать inbox-уведомление о лайке при анлайке.
     *
     * @param PipeThread|PipeReply $target сущность, лайк которой сняли
     * @param User $actor кто снял лайк
     */
    public static function unliked(PipeThread|PipeReply $target, User $actor): void
    {
        $kind = $target instanceof PipeThread ? 'thread' : 'reply';
        $ownerId = (int) $target->user_id;

        UserNotifier::deleteUnread($ownerId, 'pipe.liked', "pipe-like:{$kind}:{$target->id}:{$actor->id}");
    }

    /**
     * Уведомить автора треда о новой подписке на Pipe-ленту.
     *
     * @param User $target автор тредов
     * @param User $follower новый читатель
     */
    public static function followed(User $target, User $follower): void
    {
        try {
            $followerId = (int) $follower->id;
            $targetId = (int) $target->id;

            if ($followerId === $targetId) {
                return;
            }

            UserNotifier::send($target, new PipeFollowedNotification($target, $follower, $targetId));
        } catch (\Throwable $error) {
            Log::warning('pipe follow notify failed', ['error' => $error->getMessage()]);
        }
    }

    /**
     * Универсальный excerpt из UserNotification::excerpt — обёртка для читаемости.
     *
     * @param string|null $text текст
     * @return string|null короткий анонс
     */
    private static function excerpt(?string $text): ?string
    {
        return UserNotification::excerpt($text);
    }
}
