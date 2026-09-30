<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Тонкий клиент Bot API для панели сеансов в самом Telegram.
 *
 * Зачем отдельный класс: SendTelegramMessage умеет только
 * sendMessage из очереди, а вебхуку нужны ещё editMessageText
 * (перерисовать панель после kill/ban) и answerCallbackQuery
 * (тост «Сеанс завершён»), плюс setup-методы для команды
 * telegram:setup-bot. Вся сеть — через один baseUrl(), токен
 * никогда не светим в логах.
 */
class TelegramBotApi
{
    /**
     * Базовый URL Bot API.
     *
     * @return string|null null когда токен не задан
     */
    public static function baseUrl(): ?string
    {
        $token = (string) config('telegram.bot_token', '');

        if ($token === '') {
            return null;
        }

        return "https://api.telegram.org/bot{$token}";
    }

    /**
     * Проверить, настроен ли бот (есть токен).
     *
     * @return bool
     */
    public static function configured(): bool
    {
        return self::baseUrl() !== null;
    }

    /**
     * Отправить сообщение в личку.
     *
     * @param int $chatId telegram_id получателя
     * @param string $text текст в HTML-разметке
     * @param array<int, array<int, array<string, mixed>>> $keyboard ряды inline-кнопок
     * @return array<string, mixed>|null result sendMessage или null при ошибке
     */
    public static function sendMessage(int $chatId, string $text, array $keyboard = []): ?array
    {
        $payload = [
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ];

        if ($keyboard !== []) {
            $payload['reply_markup'] = ['inline_keyboard' => $keyboard];
        }

        return self::post('sendMessage', $payload);
    }

    /**
     * Перерисовать текст+клавиатуру уже отправленной панели.
     *
     * @param int $chatId telegram_id владельца
     * @param int $messageId id сообщения с панелью
     * @param string $text новый текст в HTML-разметке
     * @param array<int, array<int, array<string, mixed>>> $keyboard новые ряды кнопок
     * @return bool true при успехе
     */
    public static function editPanel(int $chatId, int $messageId, string $text, array $keyboard = []): bool
    {
        $payload = [
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'text' => $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ];

        if ($keyboard !== []) {
            $payload['reply_markup'] = ['inline_keyboard' => $keyboard];
        }

        return self::post('editMessageText', $payload) !== null;
    }

    /**
     * Ответить на нажатие inline-кнопки (тост сверху).
     *
     * @param string $callbackId id callback_query
     * @param string $toast короткий текст тоста (до ~200 символов)
     * @param bool $alert показать как alert вместо тоста
     * @return void
     */
    public static function answerCallback(string $callbackId, string $toast = '', bool $alert = false): void
    {
        if ($callbackId === '') {
            return;
        }

        $payload = ['callback_query_id' => $callbackId];

        if ($toast !== '') {
            $payload['text'] = mb_substr($toast, 0, 200);
        }

        if ($alert) {
            $payload['show_alert'] = true;
        }

        self::post('answerCallbackQuery', $payload);
    }

    /**
     * Зарегистрировать webhook + команды + кнопку меню Mini App.
     *
     * Вызывается из команды telegram:setup-bot, не из вебхука.
     *
     * @param string $webhookUrl https-URL .../api/telegram/webhook
     * @param string $webappUrl https-URL Mini App для кнопки меню
     * @param string $secret секрет для заголовка X-Telegram-Bot-Api-Secret-Token
     * @return array{webhook:bool,commands:bool,menu:bool} что реально встало
     */
    public static function setup(string $webhookUrl, string $webappUrl, string $secret = ''): array
    {
        $webhookPayload = [
            'url' => $webhookUrl,
            'allowed_updates' => ['message', 'callback_query'],
            'drop_pending_updates' => true,
        ];

        if ($secret !== '') {
            $webhookPayload['secret_token'] = $secret;
        }

        $webhookOk = self::post('setWebhook', $webhookPayload) !== null;

        $commandsOk = self::post('setMyCommands', [
            'commands' => [
                ['command' => 'start', 'description' => '👋 Запуск и главное меню'],
                ['command' => 'app', 'description' => '🌐 Открыть Mini App'],
                ['command' => 'profile', 'description' => '👤 Моя анкета: stats + скрыть/вернуть'],
                ['command' => 'hide', 'description' => '🙈 Скрыть анкету ото всех'],
                ['command' => 'show', 'description' => '👀 Вернуть анкету в поиск'],
                ['command' => 'likes', 'description' => '💞 Кто лайкнул меня'],
                ['command' => 'matches', 'description' => '🎉 Мои мэтчи'],
                ['command' => 'messages', 'description' => '💬 Непрочитанные сообщения'],
                ['command' => 'stats', 'description' => '📊 Уровень, репутация, тариф'],
                ['command' => 'notify', 'description' => '🔔 Уведомления: вкл/выкл'],
                ['command' => 'sessions', 'description' => '📱 Активные сеансы: завершить или забанить'],
                ['command' => 'help', 'description' => '✨ Все возможности бота'],
                ['command' => 'delete', 'description' => '💔 Удалить профиль'],
                ['command' => 'restore', 'description' => '💚 Вернуть профиль'],
            ],
        ]) !== null;

        $menuOk = self::post('setChatMenuButton', [
            'menu_button' => [
                'type' => 'web_app',
                'text' => 'Открыть приложение',
                'web_app' => ['url' => $webappUrl],
            ],
        ]) !== null;

        return ['webhook' => $webhookOk, 'commands' => $commandsOk, 'menu' => $menuOk];
    }

    /**
     * Один POST в Bot API без исключений наружу.
     *
     * @param string $method метод Bot API
     * @param array<string, mixed> $payload тело запроса
     * @return array<string, mixed>|null result при ok=true, иначе null
     */
    private static function post(string $method, array $payload): ?array
    {
        $base = self::baseUrl();

        if ($base === null) {
            return null;
        }

        try {
            $response = Http::timeout(10)->post("{$base}/{$method}", $payload);
        } catch (\Throwable $e) {
            Log::warning('telegram bot api network failed', [
                'method' => $method,
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            Log::warning('telegram bot api rejected', [
                'method' => $method,
                'status' => $response->status(),
                'body' => mb_substr((string) $response->body(), 0, 300),
            ]);

            return null;
        }

        $decoded = $response->json();

        if (! is_array($decoded) || ($decoded['ok'] ?? false) !== true) {
            return null;
        }

        $result = $decoded['result'] ?? null;

        return is_array($result) ? $result : [];
    }
}
