<?php

namespace App\Services;

use App\Events\PinCreated;
use App\Models\Pin;
use App\Models\User;
use App\Notifications\ScheduledPinPublishedNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Публикация отложенных пинов, у которых наступил publish_at.
 *
 * Единая точка для cron (`pins:publish`) и оппортунистической публикации
 * в чтениях (карта, «мои пины»): даже если планировщик не запущен,
 * первый же запрос после наступления времени опубликует due-пины.
 *
 * Каждый пин клеймится атомарно (`status=scheduled` в условии update),
 * поэтому параллельные воркеры/запросы не опубликуют его дважды,
 * а уведомление автору идемпотентно по dedupe-ключу.
 */
class ScheduledPinPublisher
{
    /**
     * Опубликовать due-пины пачкой.
     *
     * Статус scheduled → active, дальше: websocket в публичный канал map,
     * уведомления подписчикам, жителям района и самому автору
     * (inbox + broadcast user.{id} + push через UserNotifier).
     *
     * @param int $limit максимум пинов за один проход
     * @return Collection<int, Pin> опубликованные пины
     */
    public static function publishDue(int $limit = 100): Collection
    {
        // NB: scopeScheduled() — только будущее (publish_at > now) для списков.
        // Здесь нужен прямой where: status=scheduled + publish_at <= now.
        $dueIds = Pin::where('status', 'scheduled')
            ->where('publish_at', '<=', now())
            ->orderBy('publish_at')
            ->limit(max(1, $limit))
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $published = collect();

        foreach ($dueIds as $id) {
            $claimed = Pin::whereKey($id)
                ->where('status', 'scheduled')
                ->update(['status' => 'active']);

            if (! $claimed) {
                continue;
            }

            $pin = Pin::with('user:id,name,avatar_path,level,account_type')->find($id);

            if (! $pin) {
                continue;
            }

            self::announce($pin);
            $published->push($pin);
        }

        return $published;
    }

    /**
     * Разослать публикацию по всем транспортам.
     *
     * Без toOthers(): планировщик — не пользователь, а при вызове
     * из веб-запроса событие должно дойти и до автора.
     *
     * @param Pin $pin опубликованный пин с загруженным user
     */
    private static function announce(Pin $pin): void
    {
        try {
            broadcast(new PinCreated($pin));
        } catch (\Throwable $e) {
            Log::warning('reverb broadcast failed: '.$e->getMessage());
        }

        try {
            UserSubscriptionNotifier::pinCreated($pin);
        } catch (\Throwable $e) {
            Log::warning('subscription notify failed: '.$e->getMessage());
        }

        try {
            if ((int) ($pin->district_id ?? 0) > 0) {
                DistrictNotifier::pinCreated($pin);
            }
        } catch (\Throwable $e) {
            Log::warning('district notify failed: '.$e->getMessage());
        }

        try {
            $author = $pin->user ?? User::find($pin->user_id);

            if ($author) {
                UserNotifier::send($author, new ScheduledPinPublishedNotification($pin, $author));
            }
        } catch (\Throwable $e) {
            Log::warning('scheduled pin author notify failed', ['pin_id' => $pin->id, 'error' => $e->getMessage()]);
        }
    }
}
