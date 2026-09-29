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
 * Кнопка под текстом открывает Mini App сразу на нужном экране
 * (чат — прямо в диалог, остальное — на свой экран).
 *
 * Правило «только когда Mini App закрыт»: получатель онлайн
 * (last_seen_at свежее 3 минут, см. User::isAway) — сообщение уже
 * видно в realtime, в TG не дублируем. Отошёл — шлём в TG.
 *
 * Важно про Bot API: писать можно только тем, кто хоть раз нажал
 * /start у бота (иначе 403). Такой 403 помечаем в
 * `users.telegram_blocked_at` — настройки показывают подсказку
 * «нажмите Start», а не молчат. Флаг самозалечивается: успешная
 * отправка и свежая привязка через initData его снимают, иначе
 * один 403 навсегда глушил бы уведомления. Метод никогда не кидает
 * исключений: уведомление — необязательный сайд-эффект.
 */
class TelegramNotifier
{
    /**
     * Кулдаун повторов о лайке одной пары, секунд (сутки, как в письмах).
     */
    public const LIKED_COOLDOWN_SECONDS = 86400;

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
     * Шлём КАЖДОЕ сообщение, но только отошедшему получателю
     * (Mini App закрыт). Онлайн-получатель видит сообщение в realtime,
     * дубль в TG ему не нужен. Старого часового кулдауна на диалог
     * больше нет — именно он давал «то приходит, то не приходит»:
     * приходило только первое сообщение в час.
     *
     * @param User $sender автор сообщения
     * @param User $recipient получатель
     * @param Conversation $conversation диалог
     * @param string $preview превью текста (до 200 символов)
     * @return void
     */
    public static function chatMessage(User $sender, User $recipient, Conversation $conversation, string $preview): void
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return;
        }

        if (! self::canNotify($recipient, 'messages')) {
            return;
        }

        if (! $recipient->isAway()) {
            return;
        }

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
        $liked = self::resolveRecipient($liked);

        if ($liked === null) {
            return;
        }

        if (! self::canNotify($liked, 'likes')) {
            return;
        }

        if (! $liked->isAway()) {
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
            $recipient = self::resolveRecipient($recipient);

            if ($recipient === null) {
                continue;
            }

            if (! self::canNotify($recipient, 'matches')) {
                continue;
            }

            if (! $recipient->isAway()) {
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

        $buttons = [];
        $button = self::button($path, $buttonLabel);

        if ($button !== null) {
            $buttons[] = [$button];
        }

        return self::postMessage($recipient, $text, $buttons);
    }

    /**
     * Рассылка username при взаимном согласии на обмен.
     *
     * Одноразовое важное событие — шлём всегда, без гейта онлайна:
     * сам username онлайн-получатель может не заметить в панели.
     * Гейт тумблера `messages` остаётся (обмен — про общение).
     *
     * @param User $recipient кому шлём (получает username пира)
     * @param string $peerUsername username собеседника без @
     * @param string $peerName имя собеседника для текста
     * @param int $conversationId диалог для кнопки «Открыть чат»
     * @return bool true когда Telegram принял сообщение
     */
    public static function usernameExchanged(User $recipient, string $peerUsername, string $peerName, int $conversationId): bool
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return false;
        }

        if (! self::canNotify($recipient, 'messages')) {
            return false;
        }

        $cleanUsername = ltrim(trim($peerUsername), '@');

        if ($cleanUsername === '') {
            return false;
        }

        $displayName = trim($peerName) !== '' ? trim($peerName) : 'Собеседник';
        $text = '🔗 <b>'.self::escape($displayName).'</b> поделился(а) своим Telegram: @'.self::escape($cleanUsername)
            ."\nТеперь можете писать друг другу напрямую.";

        $writeButton = ['text' => 'Написать в Telegram', 'url' => 'https://t.me/'.$cleanUsername];
        $chatButton = self::button('/chat/'.$conversationId, 'Открыть чат');

        $buttons = [[$writeButton]];

        if ($chatButton !== null) {
            $buttons[] = [$chatButton];
        }

        return self::postMessage($recipient, $text, $buttons);
    }

    /**
     * POST в Bot API с обработкой 403 и самолечением блокировки.
     *
     * @param User $recipient получатель с telegram_id
     * @param string $text текст в HTML-разметке Telegram
     * @param array<int, array<int, array<string, mixed>>> $buttons ряды inline-кнопок
     * @return bool true когда Telegram принял сообщение
     */
    private static function postMessage(User $recipient, string $text, array $buttons): bool
    {
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

        if ($buttons !== []) {
            $payload['reply_markup'] = ['inline_keyboard' => $buttons];
        }

        try {
            $response = Http::timeout(8)->post("https://api.telegram.org/bot{$botToken}/sendMessage", $payload);
        } catch (\Throwable $e) {
            Log::warning('telegram send failed', ['chat_id' => $chatId, 'error' => $e->getMessage()]);

            return false;
        }

        if ($response->successful()) {
            self::clearBlocked($recipient);

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
     * telegram-полей и last_seen_at — тогда получателя перечитываем
     * целиком. Оба поля нужны: telegram_id для отправки, last_seen_at
     * для гейта «только когда Mini App закрыт» (User::isAway).
     *
     * @param User $recipient возможно урезанная модель
     * @return User|null полная модель или null
     */
    private static function resolveRecipient(User $recipient): ?User
    {
        $attributes = $recipient->getAttributes();

        $hasTelegram = array_key_exists('telegram_id', $attributes);
        $hasSeen = array_key_exists('last_seen_at', $attributes);

        if ($hasTelegram && $hasSeen) {
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
     * Снять пометку о блокировке после успешной отправки.
     *
     * Без этого один 403 (нет /start, временный блок) навсегда глушил
     * бы уведомления даже после того, как пользователь нажал /start
     * и разблокировал бота, — отсюда «раньше приходило, теперь нет».
     *
     * @param User $recipient получатель
     * @return void
     */
    private static function clearBlocked(User $recipient): void
    {
        if ($recipient->telegram_blocked_at === null) {
            return;
        }

        try {
            $recipient->forceFill(['telegram_blocked_at' => null])->saveQuietly();
        } catch (\Throwable $e) {
            Log::warning('telegram clear blocked failed', ['user_id' => $recipient->id, 'error' => $e->getMessage()]);
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
