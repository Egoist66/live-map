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

    /**
     * Короткая подпись пина для текста TG-дубля комментария.
     *
     * @param Pin $pin пин
     * @return string «пин „Заголовок“» или просто «пин»
     */
    private static function pinLabel(Pin $pin): string
    {
        $title = trim((string) ($pin->title ?? ''));

        if ($title === '') {
            return 'пин';
        }

        if (mb_strlen($title) > 60) {
            $title = mb_substr($title, 0, 57).'...';
        }

        return 'пин «'.$title.'»';
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
                try {
                    TelegramNotifier::commented($actor, $owner, self::pinLabel($pin), (string) $comment->content, "/map?pin={$pin->id}&comment={$comment->id}", (bool) ($comment->is_anonymous ?? false));
                } catch (\Throwable $e) {
                    Log::warning('telegram pin comment failed', ['error' => $e->getMessage()]);
                }
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
                try {
                    TelegramNotifier::commented($actor, $owner, self::pinLabel($pin), (string) $comment->content, "/map?pin={$pin->id}&comment={$comment->id}", (bool) ($comment->is_anonymous ?? false));
                } catch (\Throwable $e) {
                    Log::warning('telegram pin mention failed', ['error' => $e->getMessage()]);
                }
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
            try {
                TelegramNotifier::commented($actor, $owner, 'фото', (string) $comment->content, "/users/{$ownerId}?photo={$photo->id}&comment={$comment->id}");
            } catch (\Throwable $e) {
                Log::warning('telegram photo comment failed', ['error' => $e->getMessage()]);
            }
        }
    }

    public static function photoMentions(ProfilePhoto $photo, User $actor, ProfilePhotoComment $comment, array $userIds): void
    {
        foreach (Mentions::notifyableIds($userIds, (int) $actor->id) as $ownerId) {
            $owner = User::find((int) $ownerId);
            if ($owner) {
                UserNotifier::send($owner, new PhotoMentionNotification($photo, $actor, $comment, (int) $ownerId));
                try {
                    TelegramNotifier::commented($actor, $owner, 'фото', (string) $comment->content, "/users/{$photo->user_id}?photo={$photo->id}&comment={$comment->id}");
                } catch (\Throwable $e) {
                    Log::warning('telegram photo mention failed', ['error' => $e->getMessage()]);
                }
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
                try {
                    TelegramNotifier::commented($actor, $owner, 'фото', (string) $comment->content, "/users/{$photo->user_id}?photo={$photo->id}&comment={$comment->id}");
                } catch (\Throwable $e) {
                    Log::warning('telegram photo reply failed', ['error' => $e->getMessage()]);
                }
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

        $row = UserNotifier::send($liked, new DatingLikedNotification($liker, (int) $liked->id, $isIncognito, $isSuperlike));

        try {
            TelegramNotifier::liked($liker, $liked, $isIncognito, $isSuperlike);
        } catch (\Throwable $e) {
            Log::warning('telegram liked failed', ['error' => $e->getMessage()]);
        }

        return $row;
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
            TelegramNotifier::matched($me, $other, $matchId);
        } catch (\Throwable $e) {
            Log::warning('telegram matched failed', ['error' => $e->getMessage()]);
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

        $notification = UserNotifier::send($owner, new PhotoLikedNotification($photo, $actor, $ownerId));

        try {
            TelegramNotifier::entityLiked($actor, $owner, 'фото', '/swipes', "photo-like:{$photo->id}:{$actor->id}");
        } catch (\Throwable $e) {
            Log::warning('telegram photo like failed', ['error' => $e->getMessage()]);
        }

        return $notification;
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
