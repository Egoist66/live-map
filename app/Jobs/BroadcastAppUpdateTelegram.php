<?php

namespace App\Jobs;

use App\Models\AppUpdate;
use App\Services\TelegramNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Рассылка новости приложения всем пользователям Telegram-бота.
 *
 * Зачем отдельная задача: у аудитории в тысячи человек постановка
 * тысяч SendTelegramMessage прямо в HTTP-запросе админки вешала бы
 * ответ на десятки секунд. Здесь чанки по 500 идут в фоне, каждая
 * отправка — лишь dispatch в очередь (сам HTTP в Bot API делает
 * воркер SendTelegramMessage по одному с бэкоффом 429), гейты
 * (мастер, тумблер «Новости», 403-блок) и дедуп — внутри
 * TelegramNotifier::broadcastAppUpdate. Повтор новости одному
 * человеку невозможен (ключ tg:appnews:{update}:{user} на месяц).
 */
class BroadcastAppUpdateTelegram implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * Максимум попыток: рассылку важно довести, а не уронить.
     */
    public int $tries = 3;

    /**
     * @param int $appUpdateId id опубликованной новости (app_updates.id)
     */
    public function __construct(
        public int $appUpdateId,
    ) {
    }

    /**
     * Разослать новость в бота.
     *
     * @return void
     */
    public function handle(): void
    {
        $update = AppUpdate::find($this->appUpdateId);

        if (! $update) {
            return;
        }

        if (! (bool) $update->is_published) {
            Log::info('telegram appnews skipped draft', ['update_id' => $update->id]);

            return;
        }

        $queued = TelegramNotifier::broadcastAppUpdate($update);

        Log::info('telegram appnews job done', ['update_id' => $update->id, 'queued' => $queued]);
    }
}
