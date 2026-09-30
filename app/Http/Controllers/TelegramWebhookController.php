<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\TelegramBotApi;
use App\Services\TelegramSessionActions;
use App\Services\TelegramSessionsPanel;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Вебхук Telegram-бота: нативная панель сеансов в чате.
 *
 * Принимает апдейты Bot API (message + callback_query) по
 * POST /api/telegram/webhook. Авторизация — по telegram_id
 * из `from.id`: ищем users.telegram_id, чужое не отдаём.
 * Секрет вебхука (опционально) сверяем с заголовком
 * X-Telegram-Bot-Api-Secret-Token.
 *
 * Команды:
 * - /start — приветствие + кнопки «Сеансы» / «Приложение»
 * - /sessions — сразу панель активных сеансов
 *
 * Колбэки (см. TelegramSessionsPanel): sess, skill:{id},
 * sban:{id}, sunban:{id}, strust:{id}, skillall, xkill:{sid}.
 * После каждого действия панель перерисовываем через
 * editMessageText, итог показываем тостом answerCallbackQuery.
 */
class TelegramWebhookController extends Controller
{
    /**
     * Принять апдейт от Telegram.
     *
     * Всегда отвечаем 200, иначе Telegram будет долбить ретраями.
     * Ошибки — только в лог, наружу ничего не течёт.
     *
     * @param Request $request сырой апдейт Bot API
     * @return Response всегда 200 OK
     */
    public function __invoke(Request $request): Response
    {
        if (! $this->checkSecret($request)) {
            return response('forbidden', 403);
        }

        $update = $request->json()->all();

        if (! is_array($update)) {
            return response('ok', 200);
        }

        try {
            $this->dispatch($update);
        } catch (\Throwable $e) {
            Log::warning('telegram webhook failed', ['error' => $e->getMessage()]);
        }

        return response('ok', 200);
    }

    /**
     * Разобрать апдейт: сообщение или нажатие кнопки.
     *
     * @param array<string, mixed> $update апдейт Bot API
     * @return void
     */
    private function dispatch(array $update): void
    {
        $callback = $update['callback_query'] ?? null;

        if (is_array($callback)) {
            $this->handleCallback($callback);

            return;
        }

        $message = $update['message'] ?? null;

        if (is_array($message)) {
            $this->handleMessage($message);
        }
    }

    /**
     * Входящее сообщение: /start и /sessions, остальное — подсказка.
     *
     * @param array<string, mixed> $message объект message Bot API
     * @return void
     */
    private function handleMessage(array $message): void
    {
        $chatId = (int) ($message['chat']['id'] ?? 0);
        $fromId = (int) ($message['from']['id'] ?? $chatId);

        if ($chatId <= 0) {
            return;
        }

        $rawText = trim((string) ($message['text'] ?? ''));
        $command = mb_strtolower(explode(' ', $rawText)[0] ?? '');
        $command = explode('@', $command)[0];

        if ($command !== '/start' && $command !== '/sessions') {
            return;
        }

        $user = $this->findUser($fromId);

        if ($user === null) {
            $this->replyUnlinked($chatId, $command);

            return;
        }

        if ($command === '/start') {
            $this->replyStart($user, $chatId);

            return;
        }

        $this->replySessions($user, $chatId);
    }

    /**
     * Нажатие inline-кнопки панели сеансов.
     *
     * @param array<string, mixed> $callback объект callback_query Bot API
     * @return void
     */
    private function handleCallback(array $callback): void
    {
        $callbackId = (string) ($callback['id'] ?? '');
        $data = trim((string) ($callback['data'] ?? ''));
        $fromId = (int) ($callback['from']['id'] ?? 0);

        $message = $callback['message'] ?? null;
        $chatId = is_array($message) ? (int) ($message['chat']['id'] ?? 0) : 0;
        $messageId = is_array($message) ? (int) ($message['message_id'] ?? 0) : 0;

        if ($data === '' || $fromId <= 0) {
            return;
        }

        $user = $this->findUser($fromId);

        if ($user === null) {
            TelegramBotApi::answerCallback($callbackId, 'Сначала откройте Mini App и привяжите Telegram', true);

            return;
        }

        if ($chatId <= 0 || $messageId <= 0) {
            TelegramBotApi::answerCallback($callbackId, 'Не вижу панель — нажмите /sessions заново');

            return;
        }

        $toast = $this->runAction($user, $data);
        $panel = TelegramSessionsPanel::build($user->fresh() ?? $user);

        TelegramBotApi::editPanel($chatId, $messageId, $panel['text'], $panel['keyboard']);
        TelegramBotApi::answerCallback($callbackId, $toast);
    }

    /**
     * Выполнить действие колбэка, вернуть текст тоста.
     *
     * @param User $user владелец
     * @param string $data callback_data
     * @return string текст тоста
     */
    private function runAction(User $user, string $data): string
    {
        if ($data === 'sess') {
            return 'Список обновлён';
        }

        if ($data === 'skillall') {
            $result = TelegramSessionActions::terminateAll($user);

            return (string) ($result['message'] ?? 'Готово');
        }

        $parts = explode(':', $data, 2);
        $action = $parts[0] ?? '';
        $argument = $parts[1] ?? '';

        if ($action === 'xkill') {
            $result = TelegramSessionActions::killOrphan($user, $argument);

            return (string) ($result['message'] ?? 'Готово');
        }

        $deviceId = (int) $argument;

        if ($deviceId <= 0) {
            return 'Неверная кнопка — обновите список';
        }

        $result = match ($action) {
            'skill' => TelegramSessionActions::terminate($user, $deviceId),
            'sban' => TelegramSessionActions::ban($user, $deviceId),
            'sunban' => TelegramSessionActions::unban($user, $deviceId),
            'strust' => TelegramSessionActions::trust($user, $deviceId),
            default => ['ok' => false, 'message' => 'Неизвестное действие'],
        };

        return (string) ($result['message'] ?? 'Готово');
    }

    /**
     * Приветствие /start: что умеет бот + быстрый вход в панель.
     *
     * @param User $user привязанный пользователь
     * @param int $chatId куда отвечать
     * @return void
     */
    private function replyStart(User $user, int $chatId): void
    {
        $name = trim((string) $user->name);
        $hello = $name !== '' ? ', '.$this->esc($name) : '';

        $text = "👋 Привет{$hello}!\n"
            .'Я охраняю ваш аккаунт: сообщу о входе с нового устройства, а сеансами теперь можно управлять прямо здесь — без похода в настройки.';

        TelegramBotApi::sendMessage($chatId, $text, [
            [
                ['text' => '📱 Мои сеансы', 'callback_data' => 'sess'],
                TelegramSessionsPanel::openAppButton('🌐 Приложение'),
            ],
        ]);
    }

    /**
     * Ответить панелью сеансов новым сообщением.
     *
     * @param User $user владелец
     * @param int $chatId куда слать
     * @return void
     */
    private function replySessions(User $user, int $chatId): void
    {
        $panel = TelegramSessionsPanel::build($user);

        TelegramBotApi::sendMessage($chatId, $panel['text'], $panel['keyboard']);
    }

    /**
     * Ответить непривязанному: сначала открыть Mini App.
     *
     * @param int $chatId куда слать
     * @param string $command какая команда пришла
     * @return void
     */
    private function replyUnlinked(int $chatId, string $command): void
    {
        $hint = $command === '/sessions'
            ? 'Чтобы управлять сеансами из бота, сначала привяжите Telegram: откройте приложение через кнопку ниже — привязка произойдёт автоматически.'
            : 'Чтобы я узнавал вас, откройте приложение через кнопку ниже хотя бы раз — Telegram привяжется автоматически.';

        TelegramBotApi::sendMessage($chatId, $hint, [
            [TelegramSessionsPanel::openAppButton('🌐 Открыть приложение')],
        ]);
    }

    /**
     * Найти пользователя по telegram_id из апдейта.
     *
     * @param int $telegramId from.id апдейта
     * @return User|null null когда привязки нет
     */
    private function findUser(int $telegramId): ?User
    {
        if ($telegramId <= 0) {
            return null;
        }

        return User::where('telegram_id', $telegramId)->first();
    }

    /**
     * Сверить секрет вебхука, если он задан в конфиге.
     *
     * @param Request $request входящий запрос
     * @return bool true когда можно обрабатывать
     */
    private function checkSecret(Request $request): bool
    {
        $expected = (string) config('telegram.webhook_secret', '');

        if ($expected === '') {
            return true;
        }

        $given = (string) $request->header('X-Telegram-Bot-Api-Secret-Token', '');

        if ($given === '' || ! hash_equals($expected, $given)) {
            Log::warning('telegram webhook bad secret');

            return false;
        }

        return true;
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
