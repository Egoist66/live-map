<?php

namespace App\Services;

use App\Models\FlowPost;
use App\Models\FlowPostComment;
use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserSubscription;
use App\Notifications\FlowCommentedNotification;
use App\Notifications\FlowLikedNotification;
use App\Notifications\FlowMentionNotification;
use App\Notifications\FlowPostedNotification;
use App\Notifications\FlowRepliedNotification;
use App\Notifications\FlowRepostedNotification;
use Illuminate\Support\Facades\Log;

/**
 * Уведомления ленты UFlow: посты, лайки, комментарии и ответы.
 *
 * Подписчики (друзья с флагом notify_post) получают событие
 * sub_flow_post в колокольчик, владелец — flow_like / flow_comment.
 */
class FlowPostNotifier
{
    /**
     * Разослать подписчикам событие о новом посте.
     *
     * @param FlowPost $post свежий пост
     */
    public static function postCreated(FlowPost $post): void
    {
        try {
            $author = $post->user ?? User::find($post->user_id);
            if (! $author) {
                return;
            }

            $subscriberIds = self::eligibleSubscribers($post->user_id);
            if (empty($subscriberIds)) {
                return;
            }

            $excerpt = $post->title ? mb_substr(trim((string) $post->title), 0, 120) : self::excerpt($post->body);
            $subscribers = User::whereIn('id', $subscriberIds)->get();
            foreach ($subscribers as $subscriber) {
                UserNotifier::send($subscriber, new FlowPostedNotification($post, $author, (int) $subscriber->id, $excerpt));
            }
        } catch (\Throwable $e) {
            Log::warning('flow post notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Уведомить владельца о лайке.
     *
     * @param FlowPost $post пост
     * @param User $actor кто лайкнул
     */
    public static function liked(FlowPost $post, User $actor): void
    {
        $ownerId = (int) $post->user_id;
        if ($ownerId === (int) $actor->id) {
            return;
        }

        try {
            $owner = User::find($ownerId);
            if ($owner) {
                UserNotifier::send($owner, new FlowLikedNotification($post, $actor, $ownerId));
            }
        } catch (\Throwable $e) {
            Log::warning('flow like notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Убрать уведомление о лайке при анлайке.
     *
     * @param FlowPost $post пост
     * @param User $actor кто снял лайк
     */
    public static function unliked(FlowPost $post, User $actor): void
    {
        UserNotifier::deleteUnread((int) $post->user_id, 'flow.liked', "flow-like:{$post->id}:{$actor->id}");
    }

    /**
     * Уведомить владельца поста и автора родителя о комментарии.
     *
     * @param FlowPost $post пост
     * @param User $actor автор комментария
     * @param FlowPostComment $comment комментарий
     */
    public static function commented(FlowPost $post, User $actor, FlowPostComment $comment): void
    {
        try {
            $ownerId = (int) $post->user_id;
            $actorId = (int) $actor->id;
            $excerpt = self::excerpt($comment->content);

            if ($actorId !== $ownerId) {
                $owner = User::find($ownerId);
                if ($owner) {
                    UserNotifier::send($owner, new FlowCommentedNotification($post, $actor, $comment, $ownerId));
                    try {
                        TelegramNotifier::commented($actor, $owner, 'пост', (string) $comment->content, "/flow/post/{$post->id}");
                    } catch (\Throwable $e) {
                        Log::warning('telegram flow comment failed', ['error' => $e->getMessage()]);
                    }
                }
            }

            $parent = $comment->parent_id
                ? FlowPostComment::find($comment->parent_id)
                : null;

            $parentAuthorId = $parent ? (int) $parent->user_id : 0;

            $isReplyToOther = $parent
                && $parentAuthorId !== $actorId
                && $parentAuthorId !== $ownerId;

            if ($isReplyToOther) {
                $parentAuthor = User::find($parentAuthorId);
                if ($parentAuthor) {
                    UserNotifier::send($parentAuthor, new FlowRepliedNotification($post, $actor, $comment, $parentAuthorId));
                    try {
                        TelegramNotifier::commented($actor, $parentAuthor, 'пост', (string) $comment->content, "/flow/post/{$post->id}");
                    } catch (\Throwable $e) {
                        Log::warning('telegram flow reply failed', ['error' => $e->getMessage()]);
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('flow comment notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Уведомить упомянутых через @ пользователей.
     *
     * @param FlowPost $post пост
     * @param User $actor автор комментария
     * @param FlowPostComment $comment комментарий
     * @param array<int> $userIds упомянутые id
     */
    public static function mentions(FlowPost $post, User $actor, FlowPostComment $comment, array $userIds): void
    {
        try {
            $excerpt = self::excerpt($comment->content);

            foreach (Mentions::notifyableIds($userIds, (int) $actor->id) as $ownerId) {
                if ($ownerId === (int) $post->user_id) {
                    continue;
                }
                $mentioned = User::find((int) $ownerId);
                if ($mentioned) {
                    UserNotifier::send($mentioned, new FlowMentionNotification($post, $actor, $comment, (int) $ownerId));
                    try {
                        TelegramNotifier::commented($actor, $mentioned, 'пост', (string) $comment->content, "/flow/post/{$post->id}");
                    } catch (\Throwable $e) {
                        Log::warning('telegram flow mention failed', ['error' => $e->getMessage()]);
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('flow mention notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Уведомить автора оригинала о репосте.
     *
     * @param FlowPost $repost созданный репост
     * @param FlowPost $root корень цепочки
     * @param User $actor кто репостнул
     */
    public static function reposted(FlowPost $repost, FlowPost $root, User $actor): void
    {
        $ownerId = (int) $root->user_id;

        if ($ownerId === (int) $actor->id) {
            return;
        }

        try {
            $owner = User::find($ownerId);

            if ($owner) {
                UserNotifier::send($owner, new FlowRepostedNotification($repost, $root, $actor, $ownerId));
            }
        } catch (\Throwable $e) {
            Log::warning('flow repost notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Подписчики с флагом notify_post: только друзья без блокировок.
     *
     * @param int $targetId автор поста
     * @return array<int>
     */
    private static function eligibleSubscribers(int $targetId): array
    {
        $ids = UserSubscription::where('target_id', $targetId)
            ->where('notify_post', true)
            ->pluck('subscriber_id')
            ->map(fn ($value) => (int) $value)
            ->unique()
            ->values()
            ->all();

        $eligible = [];

        foreach ($ids as $subscriberId) {
            if ($subscriberId === $targetId) {
                continue;
            }

            if (! Friendship::areFriends($subscriberId, $targetId)) {
                continue;
            }

            $blocked = UserBlock::where(function ($query) use ($subscriberId, $targetId) {
                $query->where(function ($inner) use ($subscriberId, $targetId) {
                    $inner->where('blocker_id', $subscriberId)->where('blocked_id', $targetId);
                })->orWhere(function ($inner) use ($subscriberId, $targetId) {
                    $inner->where('blocker_id', $targetId)->where('blocked_id', $subscriberId);
                });
            })->exists();

            if ($blocked) {
                continue;
            }

            $eligible[] = $subscriberId;
        }

        return $eligible;
    }

    /**
     * Короткий анонс текста для уведомлений.
     *
     * @param string|null $content исходник
     */
    private static function excerpt(?string $content): ?string
    {
        $clean = trim((string) preg_replace('/\s+/', ' ', (string) $content));

        if ($clean === '') {
            return null;
        }

        if (mb_strlen($clean) > 120) {
            $clean = mb_substr($clean, 0, 117).'...';
        }

        return $clean;
    }
}
