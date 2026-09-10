<?php

namespace App\Services;

use App\Events\PinActivityCreated;
use App\Events\UserFeedUpdated;
use App\Models\Friendship;
use App\Models\Pin;
use App\Models\PinActivity;
use App\Models\ProfilePhoto;
use App\Models\User;
use App\Models\UserBlock;
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
            $subscriberIds = self::eligibleSubscribers($pin->user_id, 'notify_pin');
            $subscriberIds = self::filterVisibleForPin($subscriberIds, $pin, $author);
            $excerpt = mb_substr((string) $pin->title, 0, 120);
            foreach ($subscriberIds as $sid) {
                self::storeActivity([
                    'pin_id' => $pin->id,
                    'actor_id' => $author->id,
                    'owner_id' => $sid,
                    'kind' => 'sub_pin',
                    'excerpt' => $excerpt !== '' ? $excerpt : null,
                ]);
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
            self::pushToSubscribers($subscriberIds, $author, 'Новый пин', '«'.mb_substr((string) $pin->title, 0, 60).'»');
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
            $subscriberIds = self::eligibleSubscribers($photo->user_id, 'notify_photo');
            foreach ($subscriberIds as $sid) {
                self::storeActivity([
                    'photo_id' => $photo->id,
                    'actor_id' => $author->id,
                    'owner_id' => $sid,
                    'kind' => 'sub_photo',
                ]);
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
            self::pushToSubscribers($subscriberIds, $author, 'Новое фото', 'Загружено новое фото');
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
            $subscriberIds = self::eligibleSubscribers($user->id, 'notify_level');
            $payload = [
                'target_id' => $user->id,
                'reputation_score' => (int) $user->reputation_score,
                'level' => (string) $user->level,
                'old_reputation_score' => $oldScore,
                'old_level' => $oldLevel,
            ];
            $isLevelUp = $oldLevel !== null && $oldLevel !== (string) $user->level;
            $excerpt = $isLevelUp
                ? 'Новый уровень: '.$user->level
                : 'Репутация: '.(int) $user->reputation_score.' ★';
            foreach ($subscriberIds as $sid) {
                self::storeActivity([
                    'actor_id' => $user->id,
                    'owner_id' => $sid,
                    'kind' => 'sub_level',
                    'excerpt' => $excerpt,
                ]);
                try {
                    broadcast(new UserFeedUpdated((int) $sid, 'level', $actor, $payload));
                } catch (\Throwable $e) {
                    Log::warning('user feed broadcast failed', ['kind' => 'level', 'error' => $e->getMessage()]);
                }
            }
            $detail = $isLevelUp
                ? 'Новый уровень: '.$user->level
                : 'Репутация: '.(int) $user->reputation_score.' ★';
            self::pushToSubscribers($subscriberIds, $user, 'Обновление профиля', $detail);
        } catch (\Throwable $e) {
            Log::warning('user subscription level notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Подписчики с включённым флагом, только друзья и без взаимных блокировок.
     *
     * @param string $flag notify_pin|notify_photo|notify_level
     * @return array<int>
     */
    private static function eligibleSubscribers(int $targetId, string $flag): array
    {
        $ids = UserSubscription::where('target_id', $targetId)
            ->where($flag, true)
            ->pluck('subscriber_id')
            ->map(fn ($v) => (int) $v)
            ->unique()
            ->values()
            ->all();
        $eligible = [];
        foreach ($ids as $sid) {
            if ($sid === $targetId) {
                continue;
            }
            if (! Friendship::areFriends($sid, $targetId)) {
                continue;
            }
            $blocked = UserBlock::where(function ($q) use ($sid, $targetId) {
                $q->where(function ($x) use ($sid, $targetId) {
                    $x->where('blocker_id', $sid)->where('blocked_id', $targetId);
                })->orWhere(function ($x) use ($sid, $targetId) {
                    $x->where('blocker_id', $targetId)->where('blocked_id', $sid);
                });
            })->exists();
            if ($blocked) {
                continue;
            }
            $eligible[] = $sid;
        }
        return $eligible;
    }

    /**
     * Убрать подписчиков, которым пин не виден (пол, скрытые из поиска).
     *
     * @param array<int> $subscriberIds
     * @return array<int>
     */
    private static function filterVisibleForPin(array $subscriberIds, Pin $pin, User $author): array
    {
        if (empty($subscriberIds)) {
            return [];
        }
        $users = User::whereIn('id', $subscriberIds)->get()->keyBy('id');
        $hiddenIds = [];
        try {
            $hiddenIds = User::where('is_hidden_from_search', true)->pluck('id')->map(fn ($v) => (int) $v)->all();
        } catch (\Throwable) {
        }
        $visible = [];
        foreach ($subscriberIds as $sid) {
            $subscriber = $users->get($sid);
            if (! $subscriber) {
                continue;
            }
            if (in_array($author->id, $hiddenIds, true) && ! $subscriber->isAdmin()) {
                continue;
            }
            try {
                if (! $pin->isVisibleForGender($subscriber)) {
                    continue;
                }
            } catch (\Throwable) {
            }
            try {
                if (! PinVisibility::canView($subscriber, $pin)) {
                    continue;
                }
            } catch (\Throwable) {
            }
            $visible[] = $sid;
        }
        return $visible;
    }

    /**
     * Сохранить событие в ленту (счётчик + история) и разослать realtime.
     *
     * @param array $attributes
     */
    private static function storeActivity(array $attributes): void
    {
        try {
            $activity = PinActivity::create($attributes);
            $activity->load(['actor:id,name,avatar_path', 'pin:id,title,category', 'photo:id,user_id,caption']);
            $pin = $activity->pin;
            try {
                broadcast(new PinActivityCreated(
                    $activity,
                    $activity->pin_id ? (int) $activity->pin_id : ($pin ? (int) $pin->id : null),
                    (int) $activity->owner_id,
                    $pin ? (int) ($pin->reactions_count ?? 0) : null,
                    $pin ? (int) ($pin->comments_count ?? 0) : null,
                ));
            } catch (\Throwable $e) {
                Log::warning('subscription activity broadcast failed', ['error' => $e->getMessage()]);
            }
        } catch (\Throwable $e) {
            Log::warning('subscription activity store failed', ['error' => $e->getMessage()]);
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
