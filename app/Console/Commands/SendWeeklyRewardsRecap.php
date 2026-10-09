<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\WeeklyRewardsRecapNotification;
use App\Services\ActivityRewards;
use App\Services\ReputationService;
use App\Services\UserNotifier;
use Illuminate\Console\Command;

/**
 * Понедельничный итог недели по очкам активности.
 *
 * Каждому, кто заработал очки за прошлую неделю, кладёт уведомление
 * в колокольчик (realtime + push через UserNotifier): сколько
 * нафармил, текущий ранг и титул. Тихони без очков спама не получают.
 * Пока дефолт — чистый ULove без допразделов, итог не рассылаем:
 * система очков скрыта до релиза карты/ленты.
 */
class SendWeeklyRewardsRecap extends Command
{
    protected $signature = 'rewards:weekly-recap';

    protected $description = 'Send weekly activity points recap to earners';

    public function handle(): int
    {
        if (! \App\Services\AppSettings::isActivityReleased()) {
            $this->info('Weekly recap skipped: activity system hidden until extra modules release.');

            return self::SUCCESS;
        }

        $week = ActivityRewards::lastWeekKey();
        $notified = 0;

        User::query()
            ->select('id', 'name', 'avatar_path', 'reputation_score', 'level')
            ->chunkById(200, function ($users) use ($week, &$notified) {
                foreach ($users as $user) {
                    $stats = ActivityRewards::weeklyStats($user, $week);
                    $earned = (int) ($stats['total_earned'] ?? 0);

                    if ($earned <= 0) {
                        continue;
                    }

                    $state = ReputationService::state($user);

                    UserNotifier::send($user, new WeeklyRewardsRecapNotification(
                        $user,
                        $earned,
                        $week,
                        (string) ($state['level_name'] ?? $user->level),
                        (int) ($state['score'] ?? $user->reputation_score),
                    ));

                    $notified++;
                }
            });

        $this->info("Weekly recap sent to {$notified} user(s) for {$week}.");

        return self::SUCCESS;
    }
}
