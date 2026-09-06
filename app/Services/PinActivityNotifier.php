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

    public static function comment(Pin $pin, User $actor, PinComment $comment): void
    {
        $pin->refresh();
        $activity = null;
        if ((int) $actor->id !== (int) $pin->user_id) {
            $activity = PinActivity::create([
                'pin_id' => $pin->id,
                'actor_id' => $actor->id,
                'owner_id' => $pin->user_id,
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
        }
    }

    public static function photoComment(ProfilePhoto $photo, User $actor, ProfilePhotoComment $comment): void
    {
        if ((int) $actor->id === (int) $photo->user_id) return;
        $activity = PinActivity::create([
            'pin_id' => null,
            'actor_id' => $actor->id,
            'owner_id' => $photo->user_id,
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
