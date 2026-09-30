<?php

namespace App\Console\Commands;

use App\Services\TelegramBotApi;
use Illuminate\Console\Command;

/**
 * Регистрация бота в Telegram: webhook + команды + кнопка меню.
 *
 * Ставит:
 * - webhook на {APP_URL}/api/telegram/webhook (секрет из
 *   config telegram.webhook_secret, если задан);
 * - команды /start и /sessions (последняя открывает панель сеансов);
 * - кнопку меню Mini App (открывает приложение поверх чата).
 *
 * Запуск: php artisan telegram:setup-bot [--url=...] [--webapp=...]
 */
class SetupTelegramBot extends Command
{
    protected $signature = 'telegram:setup-bot
        {--url= : Полный https-URL вебхука (по умолчанию APP_URL/api/telegram/webhook)}
        {--webapp= : https-URL Mini App для кнопки меню (по умолчанию APP_URL/?tgWebApp=1)}';

    protected $description = 'Зарегистрировать webhook, команды и кнопку меню Telegram-бота (панель сеансов)';

    /**
     * Выполнить регистрацию бота.
     *
     * @return int self::SUCCESS при полном успехе, иначе FAILURE
     */
    public function handle(): int
    {
        if (! TelegramBotApi::configured()) {
            $this->error('TELEGRAM_BOT_TOKEN не задан — нечего регистрировать.');

            return self::FAILURE;
        }

        $base = rtrim((string) config('app.url', ''), '/');

        if ($base === '') {
            $this->error('APP_URL пуст — не могу собрать URL вебхука.');

            return self::FAILURE;
        }

        $defaultWebhook = $base.'/api/telegram/webhook';
        $defaultWebapp = $base.'/?tgWebApp=1';

        $webhookUrl = (string) ($this->option('url') ?: $defaultWebhook);
        $webappUrl = (string) ($this->option('webapp') ?: $defaultWebapp);
        $secret = (string) config('telegram.webhook_secret', '');

        if (! str_starts_with($webhookUrl, 'https://')) {
            $this->warn('Telegram требует https для webhook — проверьте APP_URL/--url.');
        }

        $this->info("Webhook: {$webhookUrl}");
        $this->info("Mini App: {$webappUrl}");

        $result = TelegramBotApi::setup($webhookUrl, $webappUrl, $secret);

        $this->table(['Шаг', 'Итог'], [
            ['setWebhook', $result['webhook'] ? 'OK' : 'FAIL'],
            ['setMyCommands (/start, /sessions)', $result['commands'] ? 'OK' : 'FAIL'],
            ['setChatMenuButton (Mini App)', $result['menu'] ? 'OK' : 'FAIL'],
        ]);

        if ($secret === '') {
            $this->warn('TELEGRAM_WEBHOOK_SECRET пуст — вебхук без проверки секрета (только для локалки).');
        }

        $ok = $result['webhook'] && $result['commands'] && $result['menu'];

        if (! $ok) {
            $this->error('Что-то не встало — смотрите лог telegram bot api.');

            return self::FAILURE;
        }

        $this->info('✓ Бот настроен: /sessions покажет панель сеансов прямо в чате.');

        return self::SUCCESS;
    }
}
