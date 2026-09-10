<?php

namespace App\Services;

use App\Events\PinActivityCreated;
use App\Events\PinCountersUpdated;
use App\Models\Pin;
use App\Models\PinActivity;
use App\Models\PinComment;
use App\Models\ProfilePhoto;
use App\Models\ProfilePhotoComment;
use App\Models\User;
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
        $activity = null;
        if ((int) $actor->id !== (int) $pin->user_id) {
            $activity = PinActivity::create([
                'pin_id' => $pin->id,
                'actor_id' => $actor->id,
                'owner_id' => $pin->user_id,
                'kind' => 'reaction',
                'reaction_type' => $type,
            ]);
            $activity->load(['actor:id,name,avatar_path', 'pin:id,title,category']);
        }
        static::broadcastCounters($pin);
        if ($activity) static::dispatchActivity($activity, $pin, null);
    }

    public static function comment(Pin $pin, User $actor, PinComment $comment, array $exceptOwnerIds = []): void
    {
        $pin->refresh();
        $activity = null;
        $ownerId = (int) $pin->user_id;
        $mentioned = array_map('intval', $exceptOwnerIds);
        if ((int) $actor->id !== $ownerId && ! in_array($ownerId, $mentioned, true)) {
            $activity = PinActivity::create([
                'pin_id' => $pin->id,
                'actor_id' => $actor->id,
                'owner_id' => $ownerId,
                'kind' => 'comment',
                'comment_id' => $comment->id,
                'excerpt' => static::excerpt($comment->content),
            ]);
            $activity->load(['actor:id,name,avatar_path', 'pin:id,title,category']);
        }
        static::broadcastCounters($pin);
        if ($activity) static::dispatchActivity($activity, $pin, null);
    }

    public static function mentions(Pin $pin, User $actor, PinComment $comment, array $userIds): void
    {
        $pin->refresh();
        static::broadcastCounters($pin);
        $excerpt = static::excerpt($comment->content);
        foreach (Mentions::notifyableIds($userIds, (int) $actor->id) as $ownerId) {
            $reused = static::reuseUnreadMention(
                ['pin_id' => $pin->id],
                ['comment_id' => $comment->id, 'excerpt' => $excerpt],
                (int) $actor->id,
                (int) $ownerId
            );
            if ($reused) {
                $reused->load(['actor:id,name,avatar_path', 'pin:id,title,category']);
                static::dispatchActivity($reused, $pin, null);
                continue;
            }
            $activity = PinActivity::create([
                'pin_id' => $pin->id,
                'actor_id' => $actor->id,
                'owner_id' => $ownerId,
                'kind' => 'mention',
                'comment_id' => $comment->id,
                'excerpt' => $excerpt,
            ]);
            $activity->load(['actor:id,name,avatar_path', 'pin:id,title,category']);
            static::dispatchActivity($activity, $pin, null);
            static::dropDuplicateComment($pin->id, $comment->id, (int) $ownerId);
        }
    }

    /**
     * Убирает generic-строку «комментарий», если тот же коммент уже
     * покрыт «упоминанием»: две иконки на один коммент не показываем.
     */
    private static function dropDuplicateComment(int $pinId, int $commentId, int $ownerId): void
    {
        try {
            PinActivity::where('owner_id', $ownerId)
                ->where('pin_id', $pinId)
                ->where('comment_id', $commentId)
                ->where('kind', 'comment')
                ->whereNull('read_at')
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('duplicate comment cleanup failed', ['error' => $e->getMessage()]);
        }
    }

    public static function photoComment(ProfilePhoto $photo, User $actor, ProfilePhotoComment $comment, array $exceptOwnerIds = []): void
    {
        $ownerId = (int) $photo->user_id;
        if ((int) $actor->id === $ownerId) return;
        if (in_array($ownerId, array_map('intval', $exceptOwnerIds), true)) return;
        $activity = PinActivity::create([
            'pin_id' => null,
            'actor_id' => $actor->id,
            'owner_id' => $ownerId,
            'kind' => 'photo_comment',
            'photo_id' => $photo->id,
            'photo_comment_id' => $comment->id,
            'excerpt' => static::excerpt($comment->content),
        ]);
        $activity->load(['actor:id,name,avatar_path', 'photo:id,user_id,caption']);
        static::dispatchActivity($activity, null, $photo);
    }

    public static function photoMentions(ProfilePhoto $photo, User $actor, ProfilePhotoComment $comment, array $userIds): void
    {
        $excerpt = static::excerpt($comment->content);
        foreach (Mentions::notifyableIds($userIds, (int) $actor->id) as $ownerId) {
            $reused = static::reuseUnreadMention(
                ['photo_id' => $photo->id],
                ['photo_comment_id' => $comment->id, 'excerpt' => $excerpt],
                (int) $actor->id,
                (int) $ownerId
            );
            if ($reused) {
                $reused->load(['actor:id,name,avatar_path', 'photo:id,user_id,caption']);
                static::dispatchActivity($reused, null, $photo);
                continue;
            }
            $activity = PinActivity::create([
                'pin_id' => null,
                'actor_id' => $actor->id,
                'owner_id' => $ownerId,
                'kind' => 'mention',
                'photo_id' => $photo->id,
                'photo_comment_id' => $comment->id,
                'excerpt' => $excerpt,
            ]);
            $activity->load(['actor:id,name,avatar_path', 'photo:id,user_id,caption']);
            static::dispatchActivity($activity, null, $photo);
            try {
                PinActivity::where('owner_id', $ownerId)
                    ->where('photo_comment_id', $comment->id)
                    ->where('kind', 'photo_comment')
                    ->whereNull('read_at')
                    ->delete();
            } catch (\Throwable $e) {
                Log::warning('duplicate photo comment cleanup failed', ['error' => $e->getMessage()]);
            }
        }
    }

    /**
     * Повторный пинг не плодит строки: одно непрочитанное упоминание
     * на пару автор → получатель в пределах пина/фото.
     * Обновляет ссылку на свежий комментарий и поднимает запись наверх.
     * Прочитанное упоминание не трогаем — дальше накапливается заново.
     *
     * @param array $scope ['pin_id' => ?int] или ['photo_id' => ?int]
     * @param array $fresh ['comment_id'|'photo_comment_id', 'excerpt']
     */
    private static function reuseUnreadMention(array $scope, array $fresh, int $actorId, int $ownerId): ?PinActivity
    {
        try {
            $query = PinActivity::where('owner_id', $ownerId)
                ->where('actor_id', $actorId)
                ->where('kind', 'mention')
                ->whereNull('read_at');
            foreach ($scope as $column => $value) {
                $query->where($column, $value);
            }
            $existing = $query->latest('id')->first();
            if (! $existing) {
                return null;
            }
            PinActivity::whereKey($existing->id)->update(array_merge($fresh, [
                'created_at' => now(),
                'updated_at' => now(),
            ]));
            return $existing->fresh();
        } catch (\Throwable $e) {
            Log::warning('mention reuse failed', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private static function excerpt(?string $content): ?string
    {
        $excerpt = trim(preg_replace('/\s+/', ' ', (string) $content) ?? '');
        if (mb_strlen($excerpt) > 120) {
            $excerpt = mb_substr($excerpt, 0, 117).'...';
        }
        return $excerpt !== '' ? $excerpt : null;
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

    private static function dispatchActivity(PinActivity $activity, ?Pin $pin, ?ProfilePhoto $photo): void
    {
        try {
            broadcast(new PinActivityCreated(
                $activity,
                $pin?->id,
                (int) $activity->owner_id,
                $pin ? (int) $pin->reactions_count : null,
                $pin ? (int) $pin->comments_count : null,
            ))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('pin activity broadcast failed', ['activity' => $activity->id, 'error' => $e->getMessage()]);
        }
        try {
            $owner = User::find($activity->owner_id);
            $actor = $activity->relationLoaded('actor') && $activity->actor ? $activity->actor : User::find($activity->actor_id);
            if ($owner && $actor) {
                if ($pin) app(WebPushService::class)->sendPinActivity($owner, $actor, $pin, $activity);
                elseif ($photo) app(WebPushService::class)->sendPhotoActivity($owner, $actor, $photo, $activity);
            }
        } catch (\Throwable $e) {
            Log::warning('pin activity webpush failed', ['activity' => $activity->id, 'error' => $e->getMessage()]);
        }
    }
}
