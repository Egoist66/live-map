<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class DowngradeExpiredPlans extends Command
{
    protected $signature = 'plans:downgrade-expired';

    protected $description = 'Downgrade users with expired paid plans back to free';

    public function handle(): int
    {
        $count = 0;
        User::whereIn('plan', ['pro', 'business'])
            ->whereNotNull('plan_expires_at')
            ->where('plan_expires_at', '<', now())
            ->chunkById(200, function ($users) use (&$count) {
                foreach ($users as $user) {
                    $user->forceFill(['plan' => 'free', 'plan_expires_at' => null])->saveQuietly();
                    $count++;
                }
            });
        $this->info("Downgraded {$count} user(s) to free.");
        return self::SUCCESS;
    }
}
