<?php

namespace App\Console\Commands;

use App\Services\AccountDeletionService;
use App\Services\UserDeletionService;
use Illuminate\Console\Command;

/**
 * Необратимо удалить профили с истёкшим grace-периодом.
 *
 * Пользователь запросил удаление → 14 дней анкета скрыта, данные целы.
 * Не вернулся — трём всё из базы через UserDeletionService (БД + файлы).
 * Вернулся — deletion_scheduled_at уже null, пропускаем.
 *
 * Запуск: php artisan users:prune-pending-deletion (ежедневно по cron).
 */
class PrunePendingDeletions extends Command
{
    protected $signature = 'users:prune-pending-deletion {--limit=100 : Максимум профилей за проход}';

    protected $description = 'Удалить всё у профилей с истёкшим 14-дневным grace-периодом удаления';

    /**
     * Удалить просроченные профили.
     *
     * @param UserDeletionService $deletion сервис полного удаления
     * @return int
     */
    public function handle(UserDeletionService $deletion): int
    {
        $limit = max(1, (int) $this->option('limit'));

        $due = AccountDeletionService::dueIds($limit);

        if ($due === []) {
            $this->info('Просроченных удалений нет.');

            return self::SUCCESS;
        }

        $removed = AccountDeletionService::pruneDue($deletion, $limit);

        $this->info("Просрочено: ".count($due).", удалено: {$removed}.");

        return self::SUCCESS;
    }
}
