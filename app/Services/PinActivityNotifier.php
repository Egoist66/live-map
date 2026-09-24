<?php

namespace App\Services;

use App\Events\PinCountersUpdated;
use App\Models\Pin;
use App\Models\PinComment;
use App\Models\ProfilePhoto;
use App\Models\ProfilePhotoComment;
use App\Models\User;
use App\Notifications\DatingLikedNotification;
use App\Notifications\DatingMatchedNotification;
use App\Notifications\PhotoCommentedNotification;
use App\Notifications\PhotoLikedNotification;
use App\Notifications\PhotoMentionNotification;
use App\Notifications\PhotoRepliedNotification;
use App\Notifications\PinCommentedNotification;
use App\Notifications\PinMentionNotification;
use App\Notifications\PinReactionNotification;
use App\Models\UserDatabaseNotification;
use Illuminate\Support\Facades\Log;

class PinActivityNotifier
{
    public static function counters(Pin $pin): void
    {
        $pin->refresh();
        static::broadcastCounters($pin);
    }

    public static function reaction(Pin $pin, User $actor, string $type): void
    {
        $pin->refresh();
        if ((int) $actor->id !== (int) $pin->user_id) {
            $owner = User::find($pin->user_id);
            if ($owner) {
                UserNotifier::send($owner, new PinReactionNotification($pin, $actor, $type, (int) $owner->id));
            }
        }
        static::broadcastCounters($pin);
    }

    public static function comment(Pin $pin, User $actor, PinComment $comment, array $exceptOwnerIds = []): void
    {
        $pin->refresh();
        $activity = null;
        $ownerId = (int) $pin->user_id;
        $mentioned = array_map('intval', $exceptOwnerIds);
        if ((int) $actor->id !== $ownerId && ! in_array($ownerId, $mentioned, true)) {
            $owner = User::find($ownerId);
            if ($owner) {
                UserNotifier::send($owner, new PinCommentedNotification($pin, $actor, $comment, $ownerId));
            }
        }
        static::broadcastCounters($pin);
    }

    public static function mentions(Pin $pin, User $actor, PinComment $comment, array $userIds): void
    {
        $pin->refresh();
        static::broadcastCounters($pin);
        foreach (Mentions::notifyableIds($userIds, (int) $actor->id) as $ownerId) {
            $owner = User::find((int) $ownerId);
            if ($owner) {
                UserNotifier::send($owner, new PinMentionNotification($pin, $actor, $comment, (int) $ownerId));
            }
            UserNotifier::deleteUnread((int) $ownerId, 'pin.commented', 'pin-comment:'.$comment->id);
        }
    }

    public static function photoComment(ProfilePhoto $photo, User $actor, ProfilePhotoComment $comment, array $exceptOwnerIds = []): void
    {
        $ownerId = (int) $photo->user_id;
        if ((int) $actor->id === $ownerId) return;
        if (in_array($ownerId, array_map('intval', $exceptOwnerIds), true)) return;
        $owner = User::find($ownerId);
        if ($owner) {
            UserNotifier::send($owner, new PhotoCommentedNotification($photo, $actor, $comment, $ownerId));
        }
    }

    public static function photoMentions(ProfilePhoto $photo, User $actor, ProfilePhotoComment $comment, array $userIds): void
    {
        foreach (Mentions::notifyableIds($userIds, (int) $actor->id) as $ownerId) {
            $owner = User::find((int) $ownerId);
            if ($owner) {
                UserNotifier::send($owner, new PhotoMentionNotification($photo, $actor, $comment, (int) $ownerId));
            }
            UserNotifier::deleteUnread((int) $ownerId, 'photo.commented', 'photo-comment:'.$comment->id);
        }
    }

    /**
     * Ответить автору родительского комментария (ответ без @ тоже доходит).
     *
     * @param ProfilePhoto $photo фото
     * @param User $actor автор ответа
     * @param ProfilePhotoComment $comment ответ
     * @param int $parentAuthorId автор родителя
     * @return void
     */
    public static function photoReplied(ProfilePhoto $photo, User $actor, ProfilePhotoComment $comment, int $parentAuthorId): void
    {
        foreach (Mentions::notifyableIds([$parentAuthorId], (int) $actor->id) as $ownerId) {
            $owner = User::find((int) $ownerId);
            if ($owner) {
                UserNotifier::send($owner, new PhotoRepliedNotification($photo, $actor, $comment, (int) $ownerId));
            }
            UserNotifier::deleteUnread((int) $ownerId, 'photo.commented', 'photo-comment:'.$comment->id);
        }
    }

    /**
     * Лайк анкеты в ULove: попадает в колокольчик получателя.
     * Инкогнито (PRO) скрывает имя/аватар, но счётчик и сам факт остаются.
     * Суперлайк выделяется отдельным текстом уведомления.
     */
    public static function swipeLiked(User $liker, User $liked, bool $isIncognito = false, bool $isSuperlike = false): ?UserDatabaseNotification
    {
        if ((int) $liker->id === (int) $liked->id) {
            return null;
        }

        return UserNotifier::send($liked, new DatingLikedNotification($liker, (int) $liked->id, $isIncognito, $isSuperlike));
    }

    /**
     * Взаимный мэтч: уведомление обоим, инкогнито раскрывается.
     */
    public static function matched(User $me, User $other, int $matchId): void
    {
        foreach ([[$other, $me], [$me, $other]] as [$recipient, $actor]) {
            UserNotifier::send($recipient, new DatingMatchedNotification($actor, (int) $recipient->id, $matchId));
        }
        try {
            UserDatabaseNotification::where('type', 'dating.liked')
                ->where(function ($q) use ($me, $other) {
                    $q->where(fn ($x) => $x->where('notifiable_id', $me->id)->where('key', 'dating-liked:'.$other->id))
                        ->orWhere(fn ($x) => $x->where('notifiable_id', $other->id)->where('key', 'dating-liked:'.$me->id));
                })
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
        } catch (\Throwable $e) {
            Log::warning('match swipe_like cleanup failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Лайк фото профиля: попадает в колокольчик владельца фото.
     */
    public static function photoLiked(ProfilePhoto $photo, User $actor): ?UserDatabaseNotification
    {
        $ownerId = (int) $photo->user_id;
        if ((int) $actor->id === $ownerId) {
            return null;
        }
        $owner = User::find($ownerId);
        if (! $owner) {
            return null;
        }

        return UserNotifier::send($owner, new PhotoLikedNotification($photo, $actor, $ownerId));
    }

    /**
     * Снять уведомление о лайке фото при анлайке.
     */
    public static function photoUnliked(ProfilePhoto $photo, User $actor): void
    {
        UserNotifier::deleteUnread((int) $photo->user_id, 'photo.liked', "photo-like:{$photo->id}:{$actor->id}");
    }

    private static function broadcastCounters(Pin $pin): void
    {
        try {
            broadcast(new PinCountersUpdated(
                $pin->id,
                (int) $pin->reactions_count,
                (int) $pin->comments_count,
            ))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('pin counters broadcast failed', ['pin' => $pin->id, 'error' => $e->getMessage()]);
        }
    }

}
