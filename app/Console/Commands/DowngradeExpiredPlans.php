<?php

namespace App\Console\Commands;

use App\Http\Controllers\SubscriptionController;
use App\Models\User;
use Illuminate\Console\Command;

/**
 * Тихий откат протухших тарифов на free.
 *
 * Срабатывает только после грейс-периода (см. SubscriptionController):
 * первые дни после конца срока пользователь видит окно продления
 * и решает сам — продлить или отказаться.
 */
class DowngradeExpiredPlans extends Command
{
    protected $signature = 'plans:downgrade-expired';

    protected $description = 'Downgrade users with expired paid plans back to free';

    public function handle(): int
    {
        $count = 0;
        $graceCutoff = now()->subDays(SubscriptionController::GRACE_DAYS);
        User::whereIn('plan', ['pro', 'premium', 'business'])
            ->whereNotNull('plan_expires_at')
            ->where('plan_expires_at', '<', $graceCutoff)
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
