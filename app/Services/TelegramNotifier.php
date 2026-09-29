<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Уведомления от лица бота @U1ove_bot в личку Telegram.
 *
 * Сценарий: человек пользуется ULove через Mini App, но приложение
 * закрыто — колокольчик и web-push не дойдут, а сообщение в Telegram
 * дойдёт всегда. Бот пишет: новые сообщения, лайки анкеты, мэтчи.
 * Кнопка под текстом открывает Mini App сразу на нужном экране.
 *
 * Важно про Bot API: писать можно только тем, кто хоть раз нажал
 * /start у бота (иначе 403). Такой 403 помечаем в
 * `users.telegram_blocked_at` — настройки показывают подсказку
 * «нажмите Start», а не молчат. Метод никогда не кидает исключений:
 * уведомление — необязательный сайд-эффект.
 */
class TelegramNotifier
{
    /**
     * Кулдаун повторов о лайке одной пары, секунд (сутки, как в письмах).
     */
    public const LIKED_COOLDOWN_SECONDS = 86400;

    /**
     * Кулдаун повторов о новых сообщениях в диалоге, секунд (час, как в письмах).
     */
    public const MESSAGE_COOLDOWN_SECONDS = 3600;

    /**
     * Можно ли писать пользователю в Telegram.
     *
     * @param User $recipient получатель
     * @param string $kind messages|likes|matches (тумблер в настройках)
     * @return bool true когда привязан id, тумблер включён и нет 403
     */
    public static function canNotify(User $recipient, string $kind): bool
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return false;
        }

        if ((int) ($recipient->telegram_id ?? 0) <= 0) {
            return false;
        }

        if ($recipient->telegram_blocked_at !== null) {
            return false;
        }

        $column = match ($kind) {
            'messages' => 'telegram_notify_messages',
            'likes' => 'telegram_notify_likes',
            'matches' => 'telegram_notify_matches',
            default => null,
        };

        if ($column === null) {
            return false;
        }

        return (bool) ($recipient->{$column} ?? true);
    }

    /**
     * Напомнить о новом сообщении в диалоге.
     *
     * @param User $sender автор сообщения
     * @param User $recipient получатель
     * @param Conversation $conversation диалог
     * @param string $preview превью текста (до 200 символов)
     * @return void
     */
    public static function chatMessage(User $sender, User $recipient, Conversation $conversation, string $preview): void
    {
        if (! self::canNotify($recipient, 'messages')) {
            return;
        }

        $key = "tg:message:{$conversation->id}:{$recipient->id}";

        if (Cache::has($key)) {
            return;
        }

        Cache::put($key, true, self::MESSAGE_COOLDOWN_SECONDS);

        $senderName = trim((string) ($sender->name ?? ''));

        if ($senderName === '') {
            $senderName = 'Собеседник';
        }

        $text = '💬 <b>'.self::escape($senderName).'</b>: '.self::escape(self::preview($preview));

        self::send($recipient, $text, '/chat/'.(int) $conversation->id, 'Открыть чат');
    }

    /**
     * Напомнить о новом лайке анкеты.
     *
     * @param User $liker автор лайка
     * @param User $liked получатель
     * @param bool $isIncognito имя скрываем и здесь
     * @param bool $isSuperlike усиленный лайк
     * @return void
     */
    public static function liked(User $liker, User $liked, bool $isIncognito = false, bool $isSuperlike = false): void
    {
        if (! self::canNotify($liked, 'likes')) {
            return;
        }

        $key = "tg:liked:{$liker->id}:{$liked->id}";

        if (Cache::has($key)) {
            return;
        }

        Cache::put($key, true, self::LIKED_COOLDOWN_SECONDS);

        if ($isIncognito) {
            $text = '💞 Вашу анкету лайкнули анонимно'.($isSuperlike ? ' · суперлайк ⭐' : '');
        } else {
            $likerName = trim((string) ($liker->name ?? ''));

            if ($likerName === '') {
                $likerName = 'Поклонник';
            }

            $text = '💞 Вас лайкнул(а): <b>'.self::escape($likerName).'</b>'.($isSuperlike ? ' · суперлайк ⭐' : '');
        }

        self::send($liked, $text, '/swipes', 'Смотреть');
    }

    /**
     * Напомнить обоим участникам о взаимном мэтче.
     *
     * @param User $me автор свайпа, закрывшего мэтч
     * @param User $other второй участник
     * @param int $matchId id мэтча
     * @return void
     */
    public static function matched(User $me, User $other, int $matchId): void
    {
        $conversation = Conversation::findDirect((int) $me->id, (int) $other->id);
        $path = $conversation ? '/chat/'.(int) $conversation->id : '/swipes';

        foreach ([[$other, $me], [$me, $other]] as [$recipient, $actor]) {
            if (! self::canNotify($recipient, 'matches')) {
                continue;
            }

            $actorName = trim((string) ($actor->name ?? ''));

            if ($actorName === '') {
                $actorName = 'Собеседник';
            }

            $text = '🎉 Мэтч! У вас взаимность с <b>'.self::escape($actorName).'</b> — чат открыт, лимиты здесь не действуют.';

            self::send($recipient, $text, $path, 'Открыть чат');
        }
    }

    /**
     * Низкоуровневая отправка текста в личку через Bot API.
     *
     * 403 (нет /start или блок) помечаем в telegram_blocked_at,
     * остальное только логируем. Исключений наружу нет.
     *
     * @param User $recipient получатель (telegram_id обязателен)
     * @param string $text текст в HTML-разметке Telegram
     * @param string|null $path путь в Mini App для кнопки (null — без кнопки)
     * @param string|null $buttonLabel подпись кнопки
     * @return bool true когда Telegram принял сообщение
     */
    public static function send(User $recipient, string $text, ?string $path = null, ?string $buttonLabel = null): bool
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return false;
        }

        $chatId = (int) ($recipient->telegram_id ?? 0);
        $botToken = (string) config('telegram.bot_token', '');

        if ($chatId <= 0 || $botToken === '') {
            return false;
        }

        $payload = [
            'chat_id' => $chatId,
            'text' => $text,
            'parse_mode' => 'HTML',
            'disable_web_page_preview' => true,
        ];

        $button = self::button($path, $buttonLabel);

        if ($button !== null) {
            $payload['reply_markup'] = ['inline_keyboard' => [[$button]]];
        }

        try {
            $response = Http::timeout(8)->post("https://api.telegram.org/bot{$botToken}/sendMessage", $payload);
        } catch (\Throwable $e) {
            Log::warning('telegram send failed', ['chat_id' => $chatId, 'error' => $e->getMessage()]);

            return false;
        }

        if ($response->successful()) {
            return true;
        }

        $status = $response->status();
        $description = (string) ($response->json('description') ?? mb_substr((string) $response->body(), 0, 200));

        if ($status === 403) {
            self::markBlocked($recipient);
        }

        Log::warning('telegram send rejected', ['chat_id' => $chatId, 'status' => $status, 'description' => $description]);

        return false;
    }

    /**
     * Догрузить telegram-колонки, если модель выбрана узким select().
     *
     * Колокольчики и пуши часто таскают `select(id, name, ...)` без
     * telegram-полей — тогда получателя перечитываем целиком.
     *
     * @param User $recipient возможно урезанная модель
     * @return User|null полная модель или null
     */
    private static function resolveRecipient(User $recipient): ?User
    {
        if (array_key_exists('telegram_id', $recipient->getAttributes())) {
            return $recipient;
        }

        try {
            return $recipient->fresh();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Пометить, что бот не может писать пользователю (нет /start или блок).
     *
     * @param User $recipient получатель
     * @return void
     */
    private static function markBlocked(User $recipient): void
    {
        try {
            $recipient->forceFill(['telegram_blocked_at' => now()])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('telegram mark blocked failed', ['user_id' => $recipient->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Кнопка под сообщением: открывает Mini App на нужном экране.
     *
     * web_app-кнопки требуют https — на локальном http откатываемся
     * на обычную url-кнопку (откроет браузер вместо Mini App).
     *
     * @param string|null $path путь в приложении
     * @param string|null $label подпись кнопки
     * @return array<string, mixed>|null кнопка или null
     */
    private static function button(?string $path, ?string $label): ?array
    {
        if ($path === null || $path === '' || $label === null || $label === '') {
            return null;
        }

        $base = rtrim((string) config('app.url', ''), '/');

        if ($base === '') {
            return null;
        }

        $url = $base.$path;

        if (str_starts_with($url, 'https://')) {
            return ['text' => $label, 'web_app' => ['url' => $url]];
        }

        return ['text' => $label, 'url' => $url];
    }

    /**
     * Превью текста: одна строка, без переносов, до 200 символов.
     *
     * @param string $text сырой текст
     * @return string
     */
    private static function preview(string $text): string
    {
        $oneLine = trim((string) preg_replace('/\s+/', ' ', $text));

        if ($oneLine === '') {
            return 'Новое сообщение';
        }

        if (mb_strlen($oneLine) > 200) {
            return mb_substr($oneLine, 0, 197).'...';
        }

        return $oneLine;
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст (имена, превью)
     * @return string
     */
    private static function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
