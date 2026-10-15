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
     * Перерисовка тем же содержимым — не ошибка: Bot API отвечает 400
     * «message is not modified», считаем успехом и не шумим в лог.
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

        return self::post('editMessageText', $payload, true) !== null;
    }

    /**
     * Отправить фото-карточку с подписью и кнопками.
     *
     * Подпись режем до 1000 символов (лимит Bot API — 1024):
     * обрезанная подпись лучше потерянного письма.
     *
     * @param int $chatId telegram_id получателя
     * @param string $photoUrl абсолютный https-URL фото
     * @param string $caption подпись в HTML-разметке
     * @param array<int, array<int, array<string, mixed>>> $keyboard ряды inline-кнопок
     * @return array<string, mixed>|null result sendPhoto или null при ошибке
     */
    public static function sendPhoto(int $chatId, string $photoUrl, string $caption, array $keyboard = []): ?array
    {
        $payload = [
            'chat_id' => $chatId,
            'photo' => $photoUrl,
            'caption' => mb_substr($caption, 0, 1000),
            'parse_mode' => 'HTML',
        ];

        if ($keyboard !== []) {
            $payload['reply_markup'] = ['inline_keyboard' => $keyboard];
        }

        return self::post('sendPhoto', $payload);
    }

    /**
     * Перерисовать подпись+клавиатуру под фото-карточкой.
     *
     * Тот же толерантный режим, что у editPanel: «message is not
     * modified» — успех, а не повод для warning в логе.
     *
     * @param int $chatId telegram_id владельца
     * @param int $messageId id сообщения с фото
     * @param string $caption новая подпись в HTML-разметке
     * @param array<int, array<int, array<string, mixed>>> $keyboard новые ряды кнопок
     * @return bool true при успехе
     */
    public static function editCaption(int $chatId, int $messageId, string $caption, array $keyboard = []): bool
    {
        $payload = [
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'caption' => mb_substr($caption, 0, 1000),
            'parse_mode' => 'HTML',
        ];

        if ($keyboard !== []) {
            $payload['reply_markup'] = ['inline_keyboard' => $keyboard];
        }

        return self::post('editMessageCaption', $payload, true) !== null;
    }

    /**
     * Заменить фото+подпись+клавиатуру у фото-карточки на месте.
     *
     * editMessageCaption меняет только текст — старое фото остаётся
     * висеть (так залипал чужой аватар в свайпах), поэтому смена
     * кандидата идёт через editMessageMedia: фото, подпись (лимит
     * Bot API — 1024, режем до 1000) и кнопки меняются одним вызовом.
     * Тот же толерантный режим, что у editPanel: «message is not
     * modified» — успех, а не повод для warning в логе.
     *
     * @param int $chatId telegram_id владельца
     * @param int $messageId id сообщения с фото
     * @param string $photoUrl абсолютный https-URL нового фото
     * @param string $caption новая подпись в HTML-разметке
     * @param array<int, array<int, array<string, mixed>>> $keyboard новые ряды кнопок
     * @return bool true при успехе
     */
    public static function editMedia(int $chatId, int $messageId, string $photoUrl, string $caption, array $keyboard = []): bool
    {
        $payload = [
            'chat_id' => $chatId,
            'message_id' => $messageId,
            'media' => [
                'type' => 'photo',
                'media' => $photoUrl,
                'caption' => mb_substr($caption, 0, 1000),
                'parse_mode' => 'HTML',
            ],
        ];

        if ($keyboard !== []) {
            $payload['reply_markup'] = ['inline_keyboard' => $keyboard];
        }

        return self::post('editMessageMedia', $payload, true) !== null;
    }

    /**
     * Удалить сообщение бота (смена типа карточки текст↔фото).
     *
     * editMessageText не правит фото и наоборот: старую карточку
     * удаляем и шлём новую нужного типа следующим сообщением.
     *
     * @param int $chatId telegram_id владельца
     * @param int $messageId что удалить
     * @return bool true при успехе
     */
    public static function deleteMessage(int $chatId, int $messageId): bool
    {
        return self::post('deleteMessage', [
            'chat_id' => $chatId,
            'message_id' => $messageId,
        ]) !== null;
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
     * Отправить CSV-выгрузку документом.
     *
     * Multipart через attach: контент не светим в логах,
     * только имя файла и chat_id.
     *
     * @param int $chatId telegram_id получателя
     * @param string $filename имя файла (profile-stats-2026-11-08.csv)
     * @param string $content содержимое CSV (UTF-8 с BOM)
     * @param string $caption подпись под файлом (HTML)
     * @return bool true при успехе
     */
    public static function sendDocument(int $chatId, string $filename, string $content, string $caption = ''): bool
    {
        $base = self::baseUrl();

        if ($base === null || $chatId <= 0) {
            return false;
        }

        try {
            $response = Http::timeout(15)->attach(
                'document',
                $content,
                $filename,
                ['Content-Type' => 'text/csv; charset=UTF-8']
            )->post("{$base}/sendDocument", [
                'chat_id' => $chatId,
                'caption' => mb_substr($caption, 0, 1000),
                'parse_mode' => 'HTML',
            ]);
        } catch (\Throwable $e) {
            Log::warning('telegram bot api network failed', [
                'method' => 'sendDocument',
                'error' => $e->getMessage(),
            ]);

            return false;
        }

        if (! $response->successful()) {
            Log::warning('telegram bot api rejected', [
                'method' => 'sendDocument',
                'status' => $response->status(),
            ]);

            return false;
        }

        $decoded = $response->json();

        return is_array($decoded) && ($decoded['ok'] ?? false) === true;
    }

    /**
     * Отправить нативный опрос (тот же вид, что опрос из скрепки 📎).
     *
     * Опросы для рассылки всем шлём неанонимными (is_anonymous=false),
     * иначе Telegram не пришлёт poll_answer и голоса не посчитать.
     * Лимиты Bot API проверяем сами, чтобы не слать заведомо
     * отклоняемые запросы: вопрос 1–300 символов, 2–10 вариантов
     * по 1–100 символов.
     *
     * @param int $chatId telegram_id получателя
     * @param string $question вопрос опроса
     * @param array<int, string> $options варианты ответа
     * @param bool $anonymous true — анонимный (без poll_answer), false — с голосами
     * @param bool $multiple true — несколько вариантов сразу
     * @param string $explanation пояснение под опросом (HTML, до 200 символов)
     * @return array<string, mixed>|null result sendPoll (message_id + poll.id) или null при ошибке
     */
    public static function sendPoll(
        int $chatId,
        string $question,
        array $options,
        bool $anonymous = false,
        bool $multiple = false,
        string $explanation = ''
    ): ?array {
        $cleanQuestion = trim(mb_substr($question, 0, 300));

        $cleanOptions = [];

        foreach ($options as $option) {
            $clean = trim((string) $option);

            if ($clean === '') {
                continue;
            }

            $cleanOptions[] = mb_substr($clean, 0, 100);
        }

        $cleanOptions = array_values($cleanOptions);

        if ($cleanQuestion === '' || count($cleanOptions) < 2 || count($cleanOptions) > 10) {
            return null;
        }

        $payload = [
            'chat_id' => $chatId,
            'question' => $cleanQuestion,
            'options' => $cleanOptions,
            'is_anonymous' => $anonymous,
            'allows_multiple_answers' => $multiple,
        ];

        $cleanExplanation = trim(mb_substr($explanation, 0, 200));

        if ($cleanExplanation !== '') {
            $payload['explanation'] = $cleanExplanation;
            $payload['explanation_parse_mode'] = 'HTML';
        }

        return self::post('sendPoll', $payload);
    }

    /**
     * Остановить опрос: голоса закрываются, видны итоги.
     *
     * Нужно админу, когда опрос отыграл: дальше только чтение
     * результатов в статистике рассылки.
     *
     * @param int $chatId telegram_id чата с опросом
     * @param int $messageId id сообщения с опросом
     * @return array<string, mixed>|null остановленный poll или null при ошибке
     */
    public static function stopPoll(int $chatId, int $messageId): ?array
    {
        if ($chatId <= 0 || $messageId <= 0) {
            return null;
        }

        return self::post('stopPoll', [
            'chat_id' => $chatId,
            'message_id' => $messageId,
        ]);
    }

    /**
     * Отправить красиво оформленную статью частями по порядку.
     *
     * Первая часть — шапка ULove + жирный заголовок; при обложке
     * она уходит подписью sendPhoto (лимит подписи 1024 — первый
     * кусок режем до 1000). Не влезшее фото (400) — откат на текст,
     * как в SendTelegramMessage. Длинный текст идёт серией сообщений
     * с пометкой «продолжение», порядок держим строгим.
     *
     * @param int $chatId telegram_id получателя
     * @param string $title заголовок статьи
     * @param string $body текст статьи (plain, переносы абзацев сохраняем)
     * @param string|null $photo https-URL обложки или file_id фото из Telegram (или null без обложки)
     * @param array<int, array<int, array<string, mixed>>> $keyboard ряды inline-кнопок (только к первой части)
     * @return bool true когда первая часть доставлена
     */
    public static function sendArticle(
        int $chatId,
        string $title,
        string $body,
        ?string $photo = null,
        array $keyboard = []
    ): bool {
        $photoValue = self::cleanArticlePhoto($photo);
        $parts = self::buildArticleParts($title, $body, $photoValue !== null);

        if ($parts === []) {
            return false;
        }

        $first = array_shift($parts);

        $sentFirst = $photoValue !== null
            ? self::sendPhoto($chatId, $photoValue, $first, $keyboard) !== null
            : self::sendMessage($chatId, $first, $keyboard) !== null;

        if (! $sentFirst && $photoValue !== null) {
            $sentFirst = self::sendMessage($chatId, $first, $keyboard) !== null;
        }

        if (! $sentFirst) {
            return false;
        }

        foreach ($parts as $part) {
            self::sendMessage($chatId, $part);
        }

        return true;
    }

    /**
     * Собрать статью в части под лимиты Bot API (чистая функция).
     *
     * Шапка + заголовок ложатся в первую часть; рвём по абзацам,
     * строкам и словам, HTML-сущности не разрываем. С обложкой
     * первая часть короче (подпись фото — до 1000 символов).
     *
     * @param string $title заголовок статьи
     * @param string $body текст статьи (plain)
     * @param bool $withPhoto true когда первая часть станет подписью фото
     * @return array<int, string> части по порядку (первая с шапкой)
     */
    public static function buildArticleParts(string $title, string $body, bool $withPhoto = false): array
    {
        $cleanTitle = trim($title);

        if ($cleanTitle === '') {
            $cleanTitle = 'Новость ULove';
        }

        $normalized = (string) preg_replace("/\r\n?/", "\n", $body);
        $normalized = (string) preg_replace("/\n{3,}/", "\n\n", trim($normalized));

        $lines = explode("\n", $normalized);
        $escapedLines = [];

        foreach ($lines as $line) {
            $escapedLines[] = self::escapeHtml($line);
        }

        $escapedBody = trim(implode("\n", $escapedLines));

        $header = '📰 💘 <b>ULove</b> • Новости'."\n\n";
        $header .= '<b>'.self::escapeHtml($cleanTitle).'</b>'."\n";
        $header .= '────────────────';

        if ($escapedBody === '') {
            return [$header];
        }

        $limit = 3900;
        $firstLimit = $withPhoto ? 1000 : $limit;
        $firstLimit = $firstLimit - mb_strlen($header) - 2;

        if ($firstLimit < 200) {
            $firstLimit = 200;
        }

        $chunks = self::chunkText($escapedBody, $firstLimit, $limit);
        $parts = [];
        $firstChunk = array_shift($chunks);

        $parts[] = $header."\n\n".(string) $firstChunk;

        foreach ($chunks as $chunk) {
            $parts[] = '<i>(продолжение)</i>'."\n\n".$chunk;
        }

        return $parts;
    }

    /**
     * Зарегистрировать webhook + команды + нативную кнопку меню.
     *
     * Важно: menu_button специально типа `commands`, а не `web_app`.
     * Кнопка web_app подменяла нативный «Меню» у поля ввода — список
     * команд пропадал и их приходилось вспоминать/печатать вручную.
     * С `commands` инпут всегда показывает «Меню» со всеми командами,
     * а Mini App открывается инлайн-кнопками 🌐 в каждой панели + /app.
     *
     * Создание публикаций — только для админов: дефолтный scope несёт
     * 26 команд без /publish, а каждый админ-чат получает персональный
     * scope (type=chat) с 27-й командой /publish. Обычный пользователь
     * /publish даже не видит в меню; набранная вручную всё равно
     * упрётся в isAdmin-гейт вебхука.
     *
     * Вызывается из команды telegram:setup-bot, не из вебхука.
     *
     * @param string $webhookUrl https-URL .../api/telegram/webhook
     * @param string $webappUrl https-URL Mini App (оставлен для совместимости, не используется)
     * @param string $secret секрет для заголовка X-Telegram-Bot-Api-Secret-Token
     * @param array<int, int> $adminChatIds telegram_id админов для scope с /publish
     * @return array{webhook:bool,commands:bool,menu:bool,admin_scopes:array{ok:int,total:int}} что реально встало
     */
    public static function setup(string $webhookUrl, string $webappUrl, string $secret = '', array $adminChatIds = []): array
    {
        $webhookPayload = [
            'url' => $webhookUrl,
            'allowed_updates' => ['message', 'callback_query', 'poll_answer'],
            'drop_pending_updates' => true,
        ];

        if ($secret !== '') {
            $webhookPayload['secret_token'] = $secret;
        }

        $webhookOk = self::post('setWebhook', $webhookPayload) !== null;

        $commandsOk = self::post('setMyCommands', [
            'commands' => self::publicCommands(),
        ]) !== null;

        $adminChats = self::cleanChatIds($adminChatIds);
        $scopesOk = 0;

        foreach ($adminChats as $adminChatId) {
            $applied = self::post('setMyCommands', [
                'commands' => self::adminCommands(),
                'scope' => ['type' => 'chat', 'chat_id' => $adminChatId],
            ]) !== null;

            if ($applied) {
                $scopesOk++;
            }
        }

        $menuOk = self::post('setChatMenuButton', [
            'menu_button' => ['type' => 'commands'],
        ]) !== null;

        return [
            'webhook' => $webhookOk,
            'commands' => $commandsOk,
            'menu' => $menuOk,
            'admin_scopes' => ['ok' => $scopesOk, 'total' => count($adminChats)],
        ];
    }

    /**
     * Команды для всех: 26 штук, без админского /publish.
     *
     * @return array<int, array{command:string, description:string}>
     */
    private static function publicCommands(): array
    {
        return [
            ['command' => 'start', 'description' => '👋 Запуск и главное меню'],
            ['command' => 'app', 'description' => '🌐 Открыть Mini App'],
            ['command' => 'profile', 'description' => '👤 Моя анкета с фото и подробностями'],
            ['command' => 'find', 'description' => '🔥 Найти мэтч здесь: свайпы в чате'],
            ['command' => 'online', 'description' => '🟢 Кто сейчас в ULove'],
            ['command' => 'favorites', 'description' => '⭐ Избранное по тарифу'],
            ['command' => 'reset', 'description' => '🔄 Сброс просмотренных свайпов'],
            ['command' => 'switch', 'description' => '🔀 Переключиться на другой аккаунт'],
            ['command' => 'account', 'description' => '👤 Какой аккаунт привязан к боту'],
            ['command' => 'hide', 'description' => '🙈 Скрыть анкету ото всех'],
            ['command' => 'show', 'description' => '👀 Вернуть анкету в поиск'],
            ['command' => 'likes', 'description' => '💞 Кто лайкнул меня'],
            ['command' => 'matches', 'description' => '🎉 Мои мэтчи'],
            ['command' => 'messages', 'description' => '💬 Непрочитанные сообщения'],
            ['command' => 'notes', 'description' => '📝 Заметки «Избранного»'],
            ['command' => 'news', 'description' => '📰 Последние новости и опросы'],
            ['command' => 'stats', 'description' => '📊 Статистика профиля по тарифу'],
            ['command' => 'export', 'description' => '📥 Выгрузка статистики в CSV'],
            ['command' => 'chatexport', 'description' => '💬 Выгрузка переписки в HTML'],
            ['command' => 'plan', 'description' => '💎 Мой тариф и выбор плана'],
            ['command' => 'email', 'description' => '📧 Моя почта для уведомлений'],
            ['command' => 'notify', 'description' => '🔔 Куда слать: бот, почта, личка'],
            ['command' => 'sessions', 'description' => '📱 Активные сеансы: завершить или забанить'],
            ['command' => 'password', 'description' => '🔑 Пароль для входа с компьютера'],
            ['command' => 'help', 'description' => '✨ Все возможности бота'],
            ['command' => 'delete', 'description' => '💔 Удалить профиль'],
            ['command' => 'restore', 'description' => '💚 Вернуть профиль'],
        ];
    }

    /**
     * Команды для админа: все публичные + /publish после /notes.
     *
     * Порядок важен: /publish стоит рядом с /news, как в помощи.
     *
     * @return array<int, array{command:string, description:string}>
     */
    private static function adminCommands(): array
    {
        $commands = self::publicCommands();
        $withPublish = [];

        foreach ($commands as $command) {
            $withPublish[] = $command;

            if (($command['command'] ?? '') === 'notes') {
                $withPublish[] = ['command' => 'publish', 'description' => '📣 Новая статья/опрос всем (админы)'];
            }
        }

        return $withPublish;
    }

    /**
     * Почистить telegram_id админов для scope: целые, положительные, без дублей.
     *
     * @param array<int, mixed> $raw сырые id
     * @return array<int, int>
     */
    private static function cleanChatIds(array $raw): array
    {
        $clean = [];

        foreach ($raw as $id) {
            $chatId = (int) $id;

            if ($chatId <= 0) {
                continue;
            }

            $clean[] = $chatId;
        }

        return array_values(array_unique($clean));
    }

    /**
     * Почистить обложку статьи: публичный https-URL или file_id.
     *
     * Админ присылает фото прямо в чат — URL у него нет, только file_id
     * из апдейта message.photo. Серверы Telegram принимают оба вида
     * в поле photo, локальный http и мусор отбрасываем.
     *
     * @param string|null $raw сырая обложка (URL или file_id)
     * @return string|null чистая обложка или null
     */
    private static function cleanArticlePhoto(?string $raw): ?string
    {
        $clean = trim((string) $raw);

        if ($clean === '') {
            return null;
        }

        if (str_contains($clean, ' ')) {
            return null;
        }

        if (mb_strlen($clean) > 512) {
            return null;
        }

        if (str_starts_with($clean, 'http://')) {
            return null;
        }

        return $clean;
    }

    /**
     * Нарезать экранированный текст на куски под лимит Bot API.
     *
     * Первый кусок короче (рядом ляжет шапка статьи), остальные —
     * по полному лимиту. Рвём по последнему двойному переносу, иначе
     * по переносу, иначе по пробелу. Разрыв внутри HTML-сущности
     * откатываем к её началу, иначе Bot API не распарсит разметку.
     *
     * @param string $text экранированный текст с переносами
     * @param int $firstLimit максимум первого куска
     * @param int $limit максимум остальных кусков
     * @return array<int, string> куски без пустых
     */
    private static function chunkText(string $text, int $firstLimit, int $limit): array
    {
        $rest = trim($text);

        if ($rest === '') {
            return [];
        }

        $chunks = [];
        $currentLimit = $firstLimit;

        while (mb_strlen($rest) > $currentLimit) {
            $window = mb_substr($rest, 0, $currentLimit);
            $cut = self::findChunkCut($window);

            if ($cut <= 0) {
                $cut = mb_strlen($window);
            }

            $piece = trim(mb_substr($rest, 0, $cut));

            if ($piece !== '') {
                $chunks[] = $piece;
            }

            $rest = trim(mb_substr($rest, $cut));
            $currentLimit = $limit;

            if ($rest === '') {
                break;
            }
        }

        if ($rest !== '') {
            $chunks[] = $rest;
        }

        return $chunks;
    }

    /**
     * Найти место разрыва куска внутри окна.
     *
     * @param string $window начало остатка длиной в лимит
     * @return int позиция разрыва (0 когда окно пустое)
     */
    private static function findChunkCut(string $window): int
    {
        if ($window === '') {
            return 0;
        }

        $cut = mb_strlen($window);

        $paragraph = mb_strrpos($window, "\n\n");

        if ($paragraph !== false && $paragraph > 0) {
            $cut = $paragraph;
        } else {
            $line = mb_strrpos($window, "\n");

            if ($line !== false && $line > 0) {
                $cut = $line;
            } else {
                $space = mb_strrpos($window, ' ');

                if ($space !== false && $space > 0) {
                    $cut = $space;
                }
            }
        }

        $head = mb_substr($window, 0, $cut);
        $ampPos = mb_strrpos($head, '&');

        if ($ampPos !== false && ($cut - $ampPos) <= 8) {
            $between = mb_substr($window, $ampPos, $cut - $ampPos);

            if (mb_strpos($between, ';') === false && $ampPos > 0) {
                $cut = $ampPos;
            }
        }

        return $cut;
    }

    /**
     * Это ответ «сообщение не изменилось» (а не настоящая ошибка).
     *
     * @param int $status HTTP-статус ответа
     * @param string $body сырое тело ответа
     * @return bool
     */
    private static function isNotModified(int $status, string $body): bool
    {
        if ($status !== 400) {
            return false;
        }

        return str_contains($body, 'message is not modified');
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private static function escapeHtml(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * Один POST в Bot API без исключений наружу.
     *
     * Флаг tolerateNotModified — для перерисовок: 400 «message is not
     * modified» означает «уже так», считаем успехом без warning в логе.
     *
     * @param string $method метод Bot API
     * @param array<string, mixed> $payload тело запроса
     * @param bool $tolerateNotModified считать «не изменено» успехом
     * @return array<string, mixed>|null result при ok=true, иначе null
     */
    private static function post(string $method, array $payload, bool $tolerateNotModified = false): ?array
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
            if ($tolerateNotModified && self::isNotModified($response->status(), (string) $response->body())) {
                return [];
            }

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
