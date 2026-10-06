<?php

namespace App\Console\Commands;

use App\Jobs\SendTelegramMessage;
use App\Models\AppUpdate;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Диагностика рассылки новости приложения в Telegram-бота.
 *
 * Проверяет по порядку всю цепочку:
 * токен бота → очередь → висящие задачи → привязки пользователей
 * → мастер-тумблер → тумблер «Новости» → 403-блоки. Отвечает на вопрос
 * «создал новость, telegram_queued=true, а в бота ничего не пришло».
 *
 * Запуск: php artisan telegram:news-debug 5
 * Проба без очереди: php artisan telegram:news-debug 5 --probe=1
 */
class DebugAppNewsTelegram extends Command
{
    protected $signature = 'telegram:news-debug
        {updateId : id новости из app_updates}
        {--probe= : id пользователя для синхронной пробы (один HTTP в Bot API мимо очереди)}';

    protected $description = 'Проверить, почему новость приложения не дошла в Telegram-бота';

    /**
     * Проверить цепочку доставки новости в бота.
     *
     * @return int 0 при успехе диагностики (даже если найдены проблемы)
     */
    public function handle(): int
    {
        $updateId = (int) $this->argument('updateId');
        $update = AppUpdate::find($updateId);

        if (! $update) {
            $this->error("Новость #{$updateId} не найдена.");

            return self::FAILURE;
        }

        $this->info("Новость #{$update->id}: «{$update->title}», is_published=" . var_export((bool) $update->is_published, true));

        if (! (bool) $update->is_published) {
            $this->warn('Новость — черновик: рассылка в бота не запускается (см. AdminAppUpdateController).');
        }

        $token = (string) config('telegram.bot_token', '');
        $tokenPresent = $token !== '';
        $this->line('TELEGRAM_BOT_TOKEN: ' . ($tokenPresent ? 'задан (длина ' . mb_strlen($token) . ')' : 'ПУСТ — Bot API недоступен'));

        if (! $tokenPresent) {
            $this->warn('Без токена SendTelegramMessage молча возвращает failed: задайте секрет на проде.');
        }

        $queueConnection = (string) config('queue.default', 'database');
        $this->line("QUEUE_CONNECTION: {$queueConnection}");

        if ($queueConnection === 'sync') {
            $this->line('Очередь sync: задачи выполняются сразу, воркер не нужен.');
        } else {
            $this->warn("Очередь {$queueConnection}: нужен живой воркер (Managed queue / queue:work), иначе задачи висят.");
        }

        $this->reportPendingJobs($updateId);

        $this->reportAudience();

        $probeId = $this->option('probe');

        if ($probeId !== null) {
            $this->probeUser((int) $probeId);
        } else {
            $this->line('Подсказка: --probe={userId} отправит одно тестовое письмо мимо очереди.');
        }

        return self::SUCCESS;
    }

    /**
     * Показать висящие задачи рассылки этой новости.
     *
     * @param int $updateId id новости
     * @return void
     */
    private function reportPendingJobs(int $updateId): void
    {
        try {
            $jobs = DB::table('jobs')->get(['id', 'queue', 'payload', 'attempts', 'available_at']);
        } catch (\Throwable $e) {
            $this->warn('Таблица jobs недоступна: ' . $e->getMessage());

            return;
        }

        $broadcastPending = 0;
        $sendPending = 0;

        foreach ($jobs as $job) {
            $payload = (string) ($job->payload ?? '');

            if (str_contains($payload, 'BroadcastAppUpdateTelegram')) {
                $broadcastPending++;
            }

            if (str_contains($payload, 'SendTelegramMessage')) {
                $sendPending++;
            }
        }

        $this->line("Задач BroadcastAppUpdateTelegram в очереди: {$broadcastPending}");
        $this->line("Задач SendTelegramMessage в очереди: {$sendPending}");

        if ($broadcastPending > 0 || $sendPending > 0) {
            $this->warn('Задачи висят в очереди — воркер их не разбирает. Проверьте Queues / Background processes в Laravel Cloud.');
        }

        try {
            $failed = DB::table('failed_jobs')->count();
            $this->line("Упавших задач (failed_jobs): {$failed}");
        } catch (\Throwable) {
            // Таблица может отсутствовать — не критично для диагностики.
        }
    }

    /**
     * Показать, скольким пользователям вообще можно писать.
     *
     * @return void
     */
    private function reportAudience(): void
    {
        $total = User::count();

        $linked = User::whereNotNull('telegram_id')->count();

        $blocked = User::whereNotNull('telegram_id')
            ->whereNotNull('telegram_blocked_at')
            ->count();

        $masterOff = User::whereNotNull('telegram_id')
            ->where('telegram_notify_enabled', false)
            ->count();

        $newsOff = User::whereNotNull('telegram_id')
            ->where('telegram_notify_news', false)
            ->count();

        $eligible = User::whereNotNull('telegram_id')
            ->whereNull('telegram_blocked_at')
            ->where(function ($query) {
                $query->whereNull('telegram_notify_enabled');
                $query->orWhere('telegram_notify_enabled', true);
            })
            ->where(function ($query) {
                $query->whereNull('telegram_notify_news');
                $query->orWhere('telegram_notify_news', true);
            })
            ->count();

        $this->table(
            ['Метрика', 'Значение'],
            [
                ['Всего пользователей', $total],
                ['С telegram_id (хоть раз /start)', $linked],
                ['Из них с 403-блоком', $blocked],
                ['Мастер-тумблер выкл', $masterOff],
                ['Тумблер «Новости» выкл', $newsOff],
                ['Дойдёт новость (eligible)', $eligible],
            ]
        );

        if ($eligible === 0) {
            $this->warn('Получателей ноль: проверьте привязку (/start у @U1ove_bot + вход через Mini App) и тумблеры уведомлений.');
        }
    }

    /**
     * Отправить одно тестовое письмо мимо очереди.
     *
     * @param int $userId id получателя
     * @return void
     */
    private function probeUser(int $userId): void
    {
        $user = User::find($userId);

        if (! $user) {
            $this->error("Пользователь #{$userId} не найден.");

            return;
        }

        $chatId = (int) ($user->telegram_id ?? 0);
        $this->line("Проба: user #{$userId}, telegram_id={$chatId}, blocked=" . var_export($user->telegram_blocked_at !== null, true));

        $text = '🔧 <b>ULove</b> • проба доставки новостей (telegram:news-debug)';

        $outcome = SendTelegramMessage::attempt($userId, $text, [], null);
        $status = (string) ($outcome['status'] ?? 'failed');

        $this->info("Итог пробы: {$status}");

        if ($status === 'sent') {
            $this->info('Токен и привязка в порядке — значит, новость застряла в очереди (нет воркера).');
        }

        if ($status === 'blocked') {
            $this->warn('Бот не может писать: нет /start или блок. Нажмите /start у @U1ove_bot.');
        }

        if ($status === 'failed') {
            $this->warn('failed без retry: проверьте TELEGRAM_BOT_TOKEN и telegram_id пользователя.');
        }
    }
}
