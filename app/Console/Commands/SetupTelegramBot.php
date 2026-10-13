<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\TelegramBotApi;
use Illuminate\Console\Command;

/**
 * Регистрация бота в Telegram: webhook + команды + нативное меню.
 *
 * Ставит:
 * - webhook на {APP_URL}/api/telegram/webhook (секрет из
 *   config telegram.webhook_secret, если задан);
 * - 26 команд всем + 27-я /publish только админам (персональный
 *   scope type=chat каждому привязанному админу; обычные пользователи
 *   /publish в меню не видят): start/app/profile/find/online/favorites/notes/publish/news/reset/
 *   switch/account/hide/show/likes/matches/messages/stats/export/chatexport/plan/email/
 *   notify/sessions/password/help/delete/restore;
 * - кнопку меню типа commands (список команд у поля ввода не прячется,
 *   Mini App открывается инлайн-кнопками 🌐 в панелях + командой /app).
 *
 * Запуск: php artisan telegram:setup-bot [--url=...] [--webapp=...]
 */
class SetupTelegramBot extends Command
{
    protected $signature = 'telegram:setup-bot
        {--url= : Полный https-URL вебхука (по умолчанию APP_URL/api/telegram/webhook)}
        {--webapp= : https-URL Mini App для кнопки меню (по умолчанию APP_URL/?tgWebApp=1)}';

    protected $description = 'Зарегистрировать webhook, 26 команд всем + /publish админам и нативное меню commands Telegram-бота';

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

        $adminChatIds = self::adminChatIds();

        if ($adminChatIds === []) {
            $this->warn('Привязанных админов с telegram_id нет — scope с /publish ставить некому (только дефолтные 26 команд).');
        }

        $result = TelegramBotApi::setup($webhookUrl, $webappUrl, $secret, $adminChatIds);
        $scopes = $result['admin_scopes'] ?? ['ok' => 0, 'total' => 0];

        $this->table(['Шаг', 'Итог'], [
            ['setWebhook', $result['webhook'] ? 'OK' : 'FAIL'],
            ['setMyCommands (26 команд всем)', $result['commands'] ? 'OK' : 'FAIL'],
            ['setMyCommands scope /publish ('.$scopes['ok'].'/'.$scopes['total'].' админов)', $scopes['ok'] === $scopes['total'] ? 'OK' : 'FAIL'],
            ['setChatMenuButton (commands у поля ввода)', $result['menu'] ? 'OK' : 'FAIL'],
        ]);

        if ($secret === '') {
            $this->warn('TELEGRAM_WEBHOOK_SECRET пуст — вебхук без проверки секрета (только для локалки).');
        }

        $ok = $result['webhook'] && $result['commands'] && $result['menu'] && $scopes['ok'] === $scopes['total'];

        if (! $ok) {
            $this->error('Что-то не встало — смотрите лог telegram bot api.');

            return self::FAILURE;
        }

        $this->info('✓ Бот настроен: 26 команд всем + /publish только админам, панели анкеты/тарифа/почты/свайпов/онлайна/избранного/заметок/публикаций/новостей/сброса/аккаунта/уведомлений/удаления/статистики прямо в чате.');

        return self::SUCCESS;
    }

    /**
     * telegram_id привязанных админов для scope с /publish.
     *
     * Базы может не быть под рукой (первый деплой) — тогда пусто,
     * команда честно предупредит, а не упадёт.
     *
     * @return array<int, int>
     */
    private static function adminChatIds(): array
    {
        try {
            $ids = User::whereNotNull('telegram_id')
                ->where(function ($query) {
                    $query->where('is_admin', true)->orWhere('role', 'admin');
                })
                ->pluck('telegram_id')
                ->all();
        } catch (\Throwable) {
            return [];
        }

        $clean = [];

        foreach ($ids as $id) {
            $chatId = (int) $id;

            if ($chatId > 0) {
                $clean[] = $chatId;
            }
        }

        return array_values(array_unique($clean));
    }
}
