<?php

namespace App\Console\Commands;

use App\Models\Pin;
use Illuminate\Console\Command;

class PruneExpiredPins extends Command
{
    protected $signature = 'pins:prune';
    protected $description = 'Удаляет просроченные пины';
    public function handle(): int
    {
        $count = Pin::where('expires_at', '<', now())->delete();
        $this->info("Pruned $count pins");
        return 0;
    }
}
