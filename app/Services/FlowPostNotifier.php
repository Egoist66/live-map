<?php

namespace App\Services;

use App\Events\PinActivityCreated;
use App\Events\UserFeedUpdated;
use App\Models\FlowPost;
use App\Models\FlowPostComment;
use App\Models\Friendship;
use App\Models\PinActivity;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserSubscription;
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

            $actor = UserFeedUpdated::actorOf($author);
            $excerpt = $post->title ? mb_substr(trim((string) $post->title), 0, 120) : self::excerpt($post->body);

            foreach ($subscriberIds as $subscriberId) {
                self::storeActivity([
                    'actor_id' => $author->id,
                    'owner_id' => $subscriberId,
                    'kind' => 'sub_flow_post',
                    'flow_post_id' => $post->id,
                    'excerpt' => $excerpt,
                ]);

                self::broadcastFeed($subscriberId, $actor, $post);
            }

            self::pushToSubscribers($subscriberIds, $author, $post, $excerpt);
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
            $exists = PinActivity::where('owner_id', $ownerId)
                ->where('actor_id', $actor->id)
                ->where('kind', 'flow_like')
                ->where('flow_post_id', $post->id)
                ->whereNull('read_at')
                ->first();

            if ($exists) {
                return;
            }

            self::storeActivity([
                'actor_id' => $actor->id,
                'owner_id' => $ownerId,
                'kind' => 'flow_like',
                'flow_post_id' => $post->id,
            ]);
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
        try {
            PinActivity::where('owner_id', $post->user_id)
                ->where('actor_id', $actor->id)
                ->where('kind', 'flow_like')
                ->where('flow_post_id', $post->id)
                ->whereNull('read_at')
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('flow unlike cleanup failed', ['error' => $e->getMessage()]);
        }
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
                self::storeActivity([
                    'actor_id' => $actorId,
                    'owner_id' => $ownerId,
                    'kind' => 'flow_comment',
                    'flow_post_id' => $post->id,
                    'flow_comment_id' => $comment->id,
                    'excerpt' => $excerpt,
                ]);
            }

            $parent = $comment->parent_id
                ? FlowPostComment::find($comment->parent_id)
                : null;

            $parentAuthorId = $parent ? (int) $parent->user_id : 0;

            $isReplyToOther = $parent
                && $parentAuthorId !== $actorId
                && $parentAuthorId !== $ownerId;

            if ($isReplyToOther) {
                self::storeActivity([
                    'actor_id' => $actorId,
                    'owner_id' => $parentAuthorId,
                    'kind' => 'flow_reply',
                    'flow_post_id' => $post->id,
                    'flow_comment_id' => $comment->id,
                    'excerpt' => $excerpt,
                ]);
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

                self::storeActivity([
                    'actor_id' => $actor->id,
                    'owner_id' => $ownerId,
                    'kind' => 'flow_mention',
                    'flow_post_id' => $post->id,
                    'flow_comment_id' => $comment->id,
                    'excerpt' => $excerpt,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('flow mention notify failed', ['error' => $e->getMessage()]);
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
     * Найти непрочитанный дубль события UFlow.
     *
     * То же правило ленты: один комментарий/пост — одна непрочитанная строка.
     *
     * @param array $attributes атрибуты PinActivity
     */
    private static function findUnreadDuplicate(array $attributes): ?PinActivity
    {
        $kind = (string) ($attributes['kind'] ?? '');
        $ownerId = (int) ($attributes['owner_id'] ?? 0);
        if ($kind === '' || $ownerId <= 0) {
            return null;
        }
        $query = PinActivity::query()->where('owner_id', $ownerId)->where('kind', $kind)->whereNull('read_at');
        $commentId = (int) ($attributes['flow_comment_id'] ?? 0);
        if ($commentId > 0) {
            $query->where('flow_comment_id', $commentId);
        } else {
            $postId = (int) ($attributes['flow_post_id'] ?? 0);
            $actorId = (int) ($attributes['actor_id'] ?? 0);
            if ($postId <= 0 || $actorId <= 0) {
                return null;
            }
            $query->where('flow_post_id', $postId)->where('actor_id', $actorId);
        }

        return $query->latest('id')->first();
    }

    /**
     * Сохранить событие и разослать realtime в личный канал.
     *
     * Идемпотентно: непрочитанный дубль поднимается наверх вместо нового ряда.
     *
     * @param array $attributes атрибуты PinActivity
     */
    private static function storeActivity(array $attributes): void
    {
        try {
            $duplicate = self::findUnreadDuplicate($attributes);
            if ($duplicate) {
                $duplicate->forceFill(['created_at' => now(), 'updated_at' => now()])->saveQuietly();
                $duplicate = $duplicate->fresh();
                $duplicate->load(['actor:id,name,avatar_path', 'flowPost:id,user_id,body']);
                broadcast(new PinActivityCreated(
                    $duplicate,
                    null,
                    (int) $duplicate->owner_id,
                    null,
                    null,
                ));

                return;
            }
            $activity = PinActivity::create($attributes);
            $activity->load(['actor:id,name,avatar_path', 'flowPost:id,user_id,body']);

            broadcast(new PinActivityCreated(
                $activity,
                null,
                (int) $activity->owner_id,
                null,
                null,
            ));
        } catch (\Throwable $e) {
            Log::warning('flow activity store failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Realtime-пинг ленты подписчика.
     *
     * @param int $subscriberId получатель
     * @param array $actor актор для UserFeedUpdated
     * @param FlowPost $post пост
     */
    private static function broadcastFeed(int $subscriberId, array $actor, FlowPost $post): void
    {
        try {
            broadcast(new UserFeedUpdated(
                $subscriberId,
                'flow_post',
                $actor,
                ['flow_post_id' => $post->id, 'target_id' => $post->user_id]
            ));
        } catch (\Throwable $e) {
            Log::warning('flow feed broadcast failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Web-push подписчикам (best-effort).
     *
     * @param array<int> $ids получатели
     * @param User $author автор поста
     * @param FlowPost $post пост
     * @param string|null $excerpt анонс текста
     */
    private static function pushToSubscribers(array $ids, User $author, FlowPost $post, ?string $excerpt): void
    {
        try {
            $users = User::whereIn('id', $ids)->get();

            foreach ($users as $user) {
                try {
                    app(WebPushService::class)->sendToUser($user, [
                        'title' => $author->name.' — новый пост в UFlow',
                        'body' => $excerpt ?? 'Открыть ленту',
                        'url' => '/flow/post/'.$post->id,
                        'tag' => 'flow-'.$post->id.'-'.$user->id,
                        'avatar' => $author->avatar_url,
                    ]);
                } catch (\Throwable) {
                }
            }
        } catch (\Throwable) {
        }
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
