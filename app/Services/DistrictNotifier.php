<?php

namespace App\Services;

use App\Events\DistrictUpdated;
use App\Models\District;
use App\Models\DistrictMember;
use App\Models\DistrictPost;
use App\Models\DistrictPostComment;
use App\Models\Pin;
use App\Models\User;
use App\Notifications\DistrictPinCreatedNotification;
use App\Notifications\DistrictPostCommentedNotification;
use App\Notifications\DistrictPostLikedNotification;
use App\Notifications\DistrictPostPublishedNotification;
use App\Notifications\DistrictPostRepliedNotification;
use Illuminate\Support\Facades\Log;

/**
 * Уведомления жителей UDistrict: пины внутри и новости района.
 *
 * Житель = владелец + approved-участники. Автор события письма
 * себе не получает. Доставка — через UserNotifier (realtime + push).
 */
class DistrictNotifier
{
    /**
     * Жители района (владелец + approved), кроме исключённых.
     *
     * @param District $district район
     * @param int $exceptId не слать этому id
     * @return array<int>
     */
    public static function residentIds(District $district, int $exceptId = 0): array
    {
        $ids = [(int) $district->user_id];

        $memberIds = DistrictMember::where('district_id', $district->id)
            ->where('status', DistrictMember::STATUS_APPROVED)
            ->pluck('user_id')
            ->map(fn ($value) => (int) $value)
            ->all();

        foreach ($memberIds as $memberId) {
            $ids[] = $memberId;
        }

        $ids = array_values(array_unique($ids));

        if ($exceptId > 0) {
            $ids = array_values(array_filter($ids, fn ($id) => $id !== $exceptId));
        }

        return $ids;
    }

    /**
     * Пин создан внутри района: всем жителям, кроме автора.
     *
     * @param Pin $pin свежий пин с district_id
     */
    public static function pinCreated(Pin $pin): void
    {
        try {
            $districtId = (int) ($pin->district_id ?? 0);

            if (! ($districtId > 0)) {
                return;
            }

            $district = District::find($districtId);

            if (! $district) {
                return;
            }

            $actor = $pin->user ?? User::find($pin->user_id);

            if (! $actor) {
                return;
            }

            $ids = self::residentIds($district, (int) $actor->id);

            if ($ids === []) {
                return;
            }

            $users = User::whereIn('id', $ids)->get();

            foreach ($users as $user) {
                UserNotifier::send($user, new DistrictPinCreatedNotification($district, $pin, $actor, (int) $user->id));
            }

            broadcast(new DistrictUpdated($district))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('district pin notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Новость опубликована: всем жителям, кроме автора.
     *
     * @param DistrictPost $post свежая новость
     */
    public static function postPublished(DistrictPost $post): void
    {
        try {
            $district = $post->district ?? District::find($post->district_id);

            if (! $district) {
                return;
            }

            $actor = $post->user ?? User::find($post->user_id);

            if (! $actor) {
                return;
            }

            $ids = self::residentIds($district, (int) $actor->id);

            if ($ids === []) {
                return;
            }

            $users = User::whereIn('id', $ids)->get();

            foreach ($users as $user) {
                UserNotifier::send($user, new DistrictPostPublishedNotification($district, $post, $actor, (int) $user->id));
            }

            broadcast(new DistrictUpdated($district))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('district post notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Лайк новости: автору новости.
     *
     * @param DistrictPost $post новость
     * @param User $actor кто лайкнул
     */
    public static function postLiked(DistrictPost $post, User $actor): void
    {
        $ownerId = (int) $post->user_id;

        if ($ownerId === (int) $actor->id) {
            return;
        }

        try {
            $district = $post->district ?? District::find($post->district_id);

            if (! $district) {
                return;
            }

            $owner = User::find($ownerId);

            if ($owner) {
                UserNotifier::send($owner, new DistrictPostLikedNotification($district, $post, $actor, $ownerId));
            }
        } catch (\Throwable $e) {
            Log::warning('district post like notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Убрать уведомление о лайке при анлайке.
     *
     * @param DistrictPost $post новость
     * @param User $actor кто снял лайк
     */
    public static function postUnliked(DistrictPost $post, User $actor): void
    {
        UserNotifier::deleteUnread((int) $post->user_id, 'district.post_liked', "district-post-like:{$post->id}:{$actor->id}");
    }

    /**
     * Комментарий новости: автору новости и автору родителя.
     *
     * @param DistrictPost $post новость
     * @param User $actor автор комментария
     * @param DistrictPostComment $comment комментарий
     */
    public static function postCommented(DistrictPost $post, User $actor, DistrictPostComment $comment): void
    {
        try {
            $district = $post->district ?? District::find($post->district_id);

            if (! $district) {
                return;
            }

            $actorId = (int) $actor->id;
            $postAuthorId = (int) $post->user_id;

            if ($actorId !== $postAuthorId) {
                $postAuthor = User::find($postAuthorId);

                if ($postAuthor) {
                    UserNotifier::send($postAuthor, new DistrictPostCommentedNotification($district, $post, $actor, $comment, $postAuthorId));

                    try {
                        TelegramNotifier::commented($actor, $postAuthor, 'новость района', (string) $comment->content, "/districts/{$district->id}");
                    } catch (\Throwable $e) {
                        Log::warning('telegram district comment failed', ['error' => $e->getMessage()]);
                    }
                }
            }

            $parent = $comment->parent_id
                ? DistrictPostComment::find($comment->parent_id)
                : null;

            $parentAuthorId = $parent ? (int) $parent->user_id : 0;
            $isReplyToOther = $parent
                && $parentAuthorId !== $actorId
                && $parentAuthorId !== $postAuthorId;

            if ($isReplyToOther) {
                $parentAuthor = User::find($parentAuthorId);

                if ($parentAuthor) {
                    UserNotifier::send($parentAuthor, new DistrictPostRepliedNotification($district, $post, $actor, $comment, $parentAuthorId));

                    try {
                        TelegramNotifier::commented($actor, $parentAuthor, 'новость района', (string) $comment->content, "/districts/{$district->id}");
                    } catch (\Throwable $e) {
                        Log::warning('telegram district reply failed', ['error' => $e->getMessage()]);
                    }
                }
            }

            broadcast(new DistrictUpdated($district))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('district post comment notify failed', ['error' => $e->getMessage()]);
        }
    }
}
