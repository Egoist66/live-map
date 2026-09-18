<?php

namespace App\Console\Commands;

use App\Services\ScheduledPinPublisher;
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
        $count = ScheduledPinPublisher::publishDue($limit)->count();

        $this->info("Published $count scheduled pins");

        return 0;
    }
}
