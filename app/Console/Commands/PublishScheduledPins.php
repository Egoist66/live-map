<?php

namespace App\Console\Commands;

use App\Events\PinCreated;
use App\Models\Pin;
use Illuminate\Console\Command;

/**
 * Публикует отложенные пины, у которых наступило время (publish_at).
 *
 * Работает в двух транспортах сразу:
 * - websocket: broadcast PinCreated в публичный канал map;
 * - realtime-bus (polling): смена status/updated_at подхватывается
 *   RealtimeController::mapChanges как upsert, уведомления подписчиков —
 *   через inbox-таблицу notifications (freshNotifications).
 */
class PublishScheduledPins extends Command
{
    protected $signature = 'pins:publish {--limit=100}';
    protected $description = 'Публикует запланированные пины, у которых наступило время (publish_at)';

    /**
     * Опубликовать due-пины пачкой.
     *
     * @return int 0 при успехе
     */
    public function handle(): int
    {
        $limit = (int) $this->option('limit');

        // NB: scopeScheduled() — только будущее (publish_at > now) для списков.
        // Здесь нужен прямой where: status=scheduled + publish_at <= now.
        $pins = Pin::where('status', 'scheduled')
            ->where('publish_at', '<=', now())
            ->orderBy('publish_at')
            ->limit($limit)
            ->with('user')
            ->get();

        $count = 0;

        foreach ($pins as $pin) {
            $pin->update(['status' => 'active']);
            $fresh = $pin->fresh('user:id,name,avatar_path,level') ?? $pin;

            // NB: без toOthers() — планировщик не пользователь,
            // событие должны получить все, включая автора.
            try {
                broadcast(new PinCreated($fresh));
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
            }

            try {
                \App\Services\UserSubscriptionNotifier::pinCreated($fresh);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('subscription notify failed: '.$e->getMessage());
            }

            $count++;
        }

        $this->info("Published $count scheduled pins");

        return 0;
    }
}
