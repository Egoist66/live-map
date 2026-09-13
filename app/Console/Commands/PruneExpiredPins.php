<?php

namespace App\Console\Commands;

use App\Events\PinDeleted;
use App\Models\Pin;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Переводит истекшие пины в архив и рассылает realtime-удаления.
 *
 * Два транспорта:
 * - websocket: broadcast PinDeleted в канал map для каждой пачки;
 * - realtime-bus: mapChanges отдаёт known_ids вне active() как deleted,
 *   поэтому отдельный REST-сигнал не нужен.
 */
class PruneExpiredPins extends Command
{
    protected $signature = 'pins:prune';
    protected $description = 'Переводит истекшие пины в архив (expired), из БД не удаляет';
    /**
     * Пометить истекшие пины и разослать удаления.
     *
     * @return int 0 при успехе
     */
    public function handle(): int
    {
        $ids = Pin::where('status', 'active')
            ->where('expires_at', '<=', now())
            ->limit(500)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (empty($ids)) {
            $this->info('Archived 0 pins');

            return 0;
        }

        $count = Pin::whereIn('id', $ids)->update(['status' => 'expired']);

        foreach ($ids as $id) {
            try {
                broadcast(new PinDeleted($id));
            } catch (\Throwable $e) {
                Log::warning('reverb broadcast failed: '.$e->getMessage());
            }
        }

        $this->info("Archived $count pins");

        return 0;
    }
}
