<?php

namespace App\Services;

use App\Events\UserFeedUpdated;
use App\Models\Pin;
use App\Models\ProfilePhoto;
use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Support\Facades\Log;

/**
 * Рассылка обновлений подписчикам пользователя.
 */
class UserSubscriptionNotifier
{
    /**
     * Уведомить подписчиков о новом пине.
     */
    public static function pinCreated(Pin $pin): void
    {
        try {
            $author = $pin->user ?? User::find($pin->user_id);
            if (! $author) return;
            $actor = UserFeedUpdated::actorOf($author);
            $ids = UserSubscription::where('target_id', $pin->user_id)
                ->where('notify_pin', true)
                ->pluck('subscriber_id');
            foreach ($ids as $sid) {
                try {
                    broadcast(new UserFeedUpdated(
                        (int) $sid,
                        'pin',
                        $actor,
                        ['pin_id' => $pin->id, 'title' => $pin->title, 'target_id' => $pin->user_id]
                    ));
                } catch (\Throwable $e) {
                    Log::warning('user feed broadcast failed', ['kind' => 'pin', 'error' => $e->getMessage()]);
                }
            }
            self::pushToSubscribers($ids, $author, 'Новый пин', '«'.mb_substr((string) $pin->title, 0, 60).'»');
        } catch (\Throwable $e) {
            Log::warning('user subscription pin notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Уведомить подписчиков о новом фото.
     */
    public static function photoCreated(ProfilePhoto $photo): void
    {
        try {
            $author = $photo->user ?? User::find($photo->user_id);
            if (! $author) return;
            $actor = UserFeedUpdated::actorOf($author);
            $ids = UserSubscription::where('target_id', $photo->user_id)
                ->where('notify_photo', true)
                ->pluck('subscriber_id');
            foreach ($ids as $sid) {
                try {
                    broadcast(new UserFeedUpdated(
                        (int) $sid,
                        'photo',
                        $actor,
                        ['photo_id' => $photo->id, 'target_id' => $photo->user_id]
                    ));
                } catch (\Throwable $e) {
                    Log::warning('user feed broadcast failed', ['kind' => 'photo', 'error' => $e->getMessage()]);
                }
            }
            self::pushToSubscribers($ids, $author, 'Новое фото', 'Загружено новое фото');
        } catch (\Throwable $e) {
            Log::warning('user subscription photo notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Уведомить подписчиков о смене репутации / уровня.
     */
    public static function levelChanged(User $user, ?int $oldScore, ?string $oldLevel): void
    {
        try {
            $actor = UserFeedUpdated::actorOf($user->fresh() ?? $user);
            $ids = UserSubscription::where('target_id', $user->id)
                ->where('notify_level', true)
                ->pluck('subscriber_id');
            $payload = [
                'target_id' => $user->id,
                'reputation_score' => (int) $user->reputation_score,
                'level' => (string) $user->level,
                'old_reputation_score' => $oldScore,
                'old_level' => $oldLevel,
            ];
            foreach ($ids as $sid) {
                try {
                    broadcast(new UserFeedUpdated((int) $sid, 'level', $actor, $payload));
                } catch (\Throwable $e) {
                    Log::warning('user feed broadcast failed', ['kind' => 'level', 'error' => $e->getMessage()]);
                }
            }
            $detail = $oldLevel !== null && $oldLevel !== (string) $user->level
                ? 'Новый уровень: '.$user->level
                : 'Репутация: '.(int) $user->reputation_score.' ★';
            self::pushToSubscribers($ids, $user, 'Обновление профиля', $detail);
        } catch (\Throwable $e) {
            Log::warning('user subscription level notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Web-push подписчикам (best-effort).
     *
     * @param \Illuminate\Support\Collection|array $ids
     */
    private static function pushToSubscribers($ids, User $author, string $title, string $body): void
    {
        try {
            $users = User::whereIn('id', collect($ids)->map(fn ($v) => (int) $v)->all())->get();
            foreach ($users as $u) {
                try {
                    app(WebPushService::class)->sendToUser($u, [
                        'title' => $title,
                        'body' => $author->name.' — '.$body,
                        'url' => '/users/'.$author->id,
                        'tag' => 'feed-'.$author->id.'-'.time(),
                        'avatar' => $author->avatar_url,
                    ]);
                } catch (\Throwable) {
                }
            }
        } catch (\Throwable) {
        }
    }
}
