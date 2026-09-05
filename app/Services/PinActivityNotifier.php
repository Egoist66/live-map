<?php

namespace App\Services;

use App\Events\PinActivityCreated;
use App\Models\Pin;
use App\Models\PinActivity;
use App\Models\PinComment;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class PinActivityNotifier
{
    public static function counters(Pin $pin): void
    {
        $pin->refresh();
        static::dispatch($pin, null);
    }

    public static function reaction(Pin $pin, User $actor, string $type): void
    {
        $pin->refresh();
        $activity = null;
        if ($actor->id !== $pin->user_id) {
            $activity = PinActivity::create([
                'pin_id' => $pin->id,
                'actor_id' => $actor->id,
                'owner_id' => $pin->user_id,
                'kind' => 'reaction',
                'reaction_type' => $type,
            ]);
            $activity->load(['actor:id,name,avatar_path', 'pin:id,title,category']);
        }
        static::dispatch($pin, $activity);
    }

    public static function comment(Pin $pin, User $actor, PinComment $comment): void
    {
        $pin->refresh();
        $activity = null;
        if ($actor->id !== $pin->user_id) {
            $excerpt = trim(preg_replace('/\s+/', ' ', $comment->content) ?? '');
            if (mb_strlen($excerpt) > 120) {
                $excerpt = mb_substr($excerpt, 0, 117).'...';
            }
            $activity = PinActivity::create([
                'pin_id' => $pin->id,
                'actor_id' => $actor->id,
                'owner_id' => $pin->user_id,
                'kind' => 'comment',
                'comment_id' => $comment->id,
                'excerpt' => $excerpt !== '' ? $excerpt : null,
            ]);
            $activity->load(['actor:id,name,avatar_path', 'pin:id,title,category']);
        }
        static::dispatch($pin, $activity);
    }

    private static function dispatch(Pin $pin, ?PinActivity $activity): void
    {
        try {
            broadcast(new PinActivityCreated(
                $activity,
                $pin->id,
                $pin->user_id,
                (int) $pin->reactions_count,
                (int) $pin->comments_count,
            ));
        } catch (\Throwable $e) {
            Log::warning('pin activity broadcast failed', ['pin' => $pin->id, 'error' => $e->getMessage()]);
        }
        if ($activity) {
            try {
                $owner = $pin->user ?? User::find($pin->user_id);
                $actor = $activity->actor ?? User::find($activity->actor_id);
                if ($owner && $actor) {
                    app(WebPushService::class)->sendPinActivity($owner, $actor, $pin, $activity);
                }
            } catch (\Throwable $e) {
                Log::warning('pin activity webpush failed', ['pin' => $pin->id, 'error' => $e->getMessage()]);
            }
        }
    }
}
