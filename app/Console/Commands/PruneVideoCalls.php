<?php

namespace App\Console\Commands;

use App\Models\VideoCall;
use App\Models\VideoSignal;
use Illuminate\Console\Command;

/**
 * Чистит метаданные звонков старше ретеншна.
 *
 * Кто/кому/когда/сколько — приватные метаданные: вечно их хранить
 * незачем. Сигналы завершённых звонков уходят каскадом по FK,
 * сиротские сигналы старше суток добиваем отдельно.
 */
class PruneVideoCalls extends Command
{
    protected $signature = 'video:prune-calls {--days=30 : старше скольки дней удалять завершённые звонки}';
    protected $description = 'Удаляет метаданные завершённых звонков старше ретеншна';

    /**
     * Удалить старые звонки и сиротские сигналы.
     *
     * @return int 0 при успехе
     */
    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));

        $calls = VideoCall::whereNotIn('status', [VideoCall::STATUS_RINGING, VideoCall::STATUS_ACTIVE])
            ->where('created_at', '<', now()->subDays($days))
            ->delete();

        $signals = VideoSignal::where('created_at', '<', now()->subDay())
            ->whereNotIn('call_id', VideoCall::select('id'))
            ->delete();

        $this->info("Pruned $calls video calls, $signals orphan signals");

        return 0;
    }
}
