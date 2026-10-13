<?php

namespace App\Jobs;

use App\Models\BotBroadcast;
use App\Services\BotBroadcastService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Рассылка публикации админа всем пользователям Telegram-бота.
 *
 * Статья уходит красиво оформленным лонгридом, опрос — нативным
 * sendPoll: каждый видит копию у себя в чате с ботом. Доставка идёт
 * чанками внутри BotBroadcastService::broadcast, дедуп по ключу
 * tg:bb:{broadcast}:{user} защищает от повторов при ретрае задачи,
 * поэтому прогон можно безопасно перезапускать.
 */
class BroadcastBotBroadcastTelegram implements ShouldQueue
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
     * @param int $broadcastId id публикации (bot_broadcasts.id)
     */
    public function __construct(
        public int $broadcastId,
    ) {
    }

    /**
     * Разнести публикацию в бота.
     *
     * @return void
     */
    public function handle(): void
    {
        $broadcast = BotBroadcast::find($this->broadcastId);

        if (! $broadcast) {
            return;
        }

        if ($broadcast->status !== 'sending') {
            Log::info('telegram broadcast skipped: not sending', ['broadcast_id' => $broadcast->id]);

            return;
        }

        BotBroadcastService::broadcast($broadcast);

        $broadcast->forceFill(['status' => 'sent'])->save();

        try {
            broadcast(new \App\Events\BotBroadcastFinished($broadcast->fresh() ?? $broadcast));
        } catch (\Throwable $e) {
            Log::warning('telegram broadcast event failed', ['broadcast_id' => $broadcast->id, 'error' => $e->getMessage()]);
        }

        Log::info('telegram broadcast job done', ['broadcast_id' => $broadcast->id]);
    }
}
