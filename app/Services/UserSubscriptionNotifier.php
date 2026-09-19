<?php

namespace App\Services;

use App\Models\Friendship;
use App\Models\Pin;
use App\Models\ProfilePhoto;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserSubscription;
use App\Notifications\PhotoPublishedNotification;
use App\Notifications\PinPublishedNotification;
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
            $subscriberIds = self::eligibleSubscribers($pin->user_id, 'notify_pin');
            $subscriberIds = self::filterVisibleForPin($subscriberIds, $pin, $author);
            $subscribers = User::whereIn('id', $subscriberIds)->get();
            foreach ($subscribers as $subscriber) {
                UserNotifier::send($subscriber, new PinPublishedNotification($pin, $author, (int) $subscriber->id));
            }
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
            $subscriberIds = self::eligibleSubscribers($photo->user_id, 'notify_photo');
            $subscribers = User::whereIn('id', $subscriberIds)->get();
            foreach ($subscribers as $subscriber) {
                UserNotifier::send($subscriber, new PhotoPublishedNotification($photo, $author, (int) $subscriber->id));
            }
        } catch (\Throwable $e) {
            Log::warning('user subscription photo notify failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Подписчики с включённым флагом, только друзья и без взаимных блокировок.
     *
     * Репутация/уровень — приватны и подписчикам не рассылаются:
     * свой итог каждый видит лично в недельном отчёте (rewards.weekly).
     *
     * @param string $flag notify_pin|notify_photo
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

}
