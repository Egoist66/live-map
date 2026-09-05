<?php

namespace App\Console\Commands;

use App\Models\Pin;
use Illuminate\Console\Command;

class PruneExpiredPins extends Command
{
    protected $signature = 'pins:prune';
    protected $description = 'Переводит истекшие пины в архив (expired), из БД не удаляет';
    public function handle(): int
    {
        $count = Pin::where('status', 'active')->where('expires_at', '<=', now())->update(['status' => 'expired']);
        $this->info("Archived $count pins");
        return 0;
    }
}
