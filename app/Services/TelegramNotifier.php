<?php

namespace App\Services;

use App\Jobs\SendTelegramMessage;
use App\Models\Conversation;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Уведомления от лица бота @U1ove_bot в личку Telegram.
 *
 * Сценарий: человек пользуется ULove через Mini App, но приложение
 * закрыто — колокольчик и web-push не дойдут, а сообщение в Telegram
 * дойдёт всегда. Бот пишет: новые сообщения, лайки анкеты, мэтчи,
 * комментарии (пины, фото, посты, новости районов).
 * Кнопка под текстом открывает Mini App сразу на нужном экране
 * (чат — прямо в диалог, остальное — на свой экран).
 *
 * Правило «только когда Mini App закрыт»: получатель онлайн
 * (last_seen_at свежее 3 минут, см. User::isAway) — сообщение уже
 * видно в realtime, в TG не дублируем. Отошёл — шлём в TG.
 *
 * Доставка строго 1-в-1 без пауз и склейки: каждое событие сразу
 * уходит в очередь SendTelegramMessage, воркер шлёт по одному.
 * Если Bot API ответил 429, задача возвращается в очередь с
 * задержкой retry_after и доезжает позже — письма не теряются.
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
     * TTL дедупа одного события, секунд (сутки).
     *
     * Защита от двойной постановки в очередь при ретрае запроса
     * с клиента: одно сообщение даёт ровно один дубль в TG.
     */
    public const DEDUP_TTL_SECONDS = 86400;

    /**
     * Можно ли писать пользователю в Telegram.
     *
     * @param User $recipient получатель
     * @param string $kind messages|likes|matches|comments (тумблер в настройках)
     * @return bool true когда привязан id, тумблер включён и нет 403
     */
    public static function canNotify(User $recipient, string $kind): bool
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return false;
        }

        if ((int) ($recipient->telegram_id ?? 0) <= 0) {
            self::logSkip($recipient, $kind, 'unlinked');

            return false;
        }

        if ($recipient->telegram_blocked_at !== null) {
            self::logSkip($recipient, $kind, 'blocked');

            return false;
        }

        $column = match ($kind) {
            'messages' => 'telegram_notify_messages',
            'likes' => 'telegram_notify_likes',
            'matches' => 'telegram_notify_matches',
            'comments' => 'telegram_notify_comments',
            default => null,
        };

        if ($column === null) {
            return false;
        }

        if (! (bool) ($recipient->{$column} ?? true)) {
            self::logSkip($recipient, $kind, 'toggle-off');

            return false;
        }

        return true;
    }

    /**
     * Напомнить о новом сообщении в диалоге.
     *
     * Каждое сообщение — отдельным письмом в TG, сразу в очередь,
     * без пауз и склейки. Только отошедшему получателю (Mini App
     * закрыт): онлайн видит сообщение в realtime, дубль не нужен.
     *
     * @param User $sender автор сообщения
     * @param User $recipient получатель
     * @param Conversation $conversation диалог
     * @param string $preview превью текста (до 200 символов)
     * @param int|null $messageId id сообщения для дедупа повторов
     * @return void
     */
    public static function chatMessage(User $sender, User $recipient, Conversation $conversation, string $preview, ?int $messageId = null): void
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return;
        }

        if (! self::canNotify($recipient, 'messages')) {
            return;
        }

        if (! $recipient->isAway()) {
            self::logSkip($recipient, 'messages', 'online');

            return;
        }

        if ($messageId !== null && $messageId > 0) {
            $dedupKey = 'tg:sentmsg:'.$messageId.':'.$recipient->id;

            if (Cache::has($dedupKey)) {
                self::logSkip($recipient, 'messages', 'duplicate');

                return;
            }

            Cache::put($dedupKey, true, self::DEDUP_TTL_SECONDS);
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
            self::logSkip($liked, 'likes', 'online');

            return;
        }

        $key = "tg:liked:{$liker->id}:{$liked->id}";

        if (Cache::has($key)) {
            self::logSkip($liked, 'likes', 'cooldown');

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
                self::logSkip($recipient, 'matches', 'online');

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
     * Напомнить о новом комментарии (пин, фото, пост, новость района).
     *
     * Каждый комментарий — отдельным письмом в TG, сразу в очередь,
     * без пауз и склейки. Анонимные комменты имя не палят.
     *
     * @param User $actor автор комментария
     * @param User $recipient кому адресован (владелец/автор родителя/упомянутый)
     * @param string $entityLabel что комментируют («пин „Кофе тут“», «фото», «пост»)
     * @param string $preview текст комментария (обрежется до 200 символов)
     * @param string $path путь в Mini App для кнопки «Смотреть»
     * @param bool $anonymous скрыть имя автора
     * @param int|null $commentId id комментария для дедупа повторов
     * @return void
     */
    public static function commented(User $actor, User $recipient, string $entityLabel, string $preview, string $path, bool $anonymous = false, ?int $commentId = null): void
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return;
        }

        if (! self::canNotify($recipient, 'comments')) {
            return;
        }

        if (! $recipient->isAway()) {
            self::logSkip($recipient, 'comments', 'online');

            return;
        }

        if ($commentId !== null && $commentId > 0) {
            $dedupKey = 'tg:sentcomment:'.$commentId.':'.$recipient->id;

            if (Cache::has($dedupKey)) {
                self::logSkip($recipient, 'comments', 'duplicate');

                return;
            }

            Cache::put($dedupKey, true, self::DEDUP_TTL_SECONDS);
        }

        if ($anonymous) {
            $authorPart = 'Аноним';
        } else {
            $actorName = trim((string) ($actor->name ?? ''));
            $authorPart = $actorName !== '' ? $actorName : 'Собеседник';
        }

        $entity = trim($entityLabel) !== '' ? trim($entityLabel) : 'запись';

        $text = '💬 <b>'.self::escape($authorPart).'</b> прокомментировал(а): '.self::escape($entity)
            .' — «'.self::escape(self::preview($preview)).'»';

        self::send($recipient, $text, $path, 'Смотреть');
    }

    /**
     * Поставить текст в очередь отправки в личку через Bot API.
     *
     * Сам HTTP делает воркер SendTelegramMessage: 429 возвращает
     * задачу в очередь с задержкой retry_after, 403 помечает блок.
     * Метод никогда не кидает исключений и не ждёт Telegram —
     * отправитель не висит на сетевых ретраях.
     *
     * @param User $recipient получатель (telegram_id обязателен)
     * @param string $text текст в HTML-разметке Telegram
     * @param string|null $path путь в Mini App для кнопки (null — без кнопки)
     * @param string|null $buttonLabel подпись кнопки
     * @return bool true когда задача принята в очередь
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

        return self::dispatchMessage((int) $recipient->id, $text, $buttons);
    }

    /**
     * Алерт о входе с нативной панелью сеансов в боте.
     *
     * Вместо одной web_app-кнопки «Мои сеансы» (вела в Mini App
     * на /settings/security#sessions, но могла открыться не на том
     * табе) даём два ряда: callback-кнопка «Показать сеансы» сразу
     * рисует панель kill/ban в чате через вебхук, web_app — запасной
     * путь в раздел Безопасность Mini App.
     *
     * @param User $recipient владелец аккаунта
     * @param string $text текст алерта в HTML-разметке Telegram
     * @return bool true когда задача принята в очередь
     */
    public static function securityAlert(User $recipient, string $text): bool
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return false;
        }

        $rows = [
            [
                ['text' => '📱 Показать сеансы', 'callback_data' => 'sess'],
            ],
        ];

        $fallback = self::button('/settings/security#sessions', '🌐 Безопасность в приложении');

        if ($fallback !== null) {
            $rows[] = [$fallback];
        }

        return self::dispatchMessage((int) $recipient->id, $text, $rows);
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
     * @return bool true когда задача принята в очередь
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

        return self::dispatchMessage((int) $recipient->id, $text, $buttons);
    }

    /**
     * Поставить одно письмо в очередь Bot API.
     *
     * Сам HTTP делает воркер SendTelegramMessage по одному письму
     * за раз: серия уходит 1-в-1 в порядке постановки, а 429 лишь
     * откладывает задачу на retry_after — ничего не теряется.
     * Если очередь недоступна (диспатч кинул исключение), шлём
     * синхронно одной попыткой, чтобы письмо не пропало.
     *
     * @param int $userId id получателя (users.id)
     * @param string $text текст в HTML-разметке Telegram
     * @param array<int, array<int, array<string, mixed>>> $buttons ряды inline-кнопок
     * @return bool true когда задача принята (очередь или прямая отправка)
     */
    private static function dispatchMessage(int $userId, string $text, array $buttons): bool
    {
        if ($userId <= 0) {
            return false;
        }

        try {
            SendTelegramMessage::dispatch($userId, $text, $buttons);

            return true;
        } catch (\Throwable $e) {
            Log::warning('telegram dispatch failed', ['user_id' => $userId, 'error' => $e->getMessage()]);
        }

        try {
            $outcome = SendTelegramMessage::attempt($userId, $text, $buttons);

            return ($outcome['status'] ?? '') === 'sent';
        } catch (\Throwable $e) {
            Log::warning('telegram direct fallback failed', ['user_id' => $userId, 'error' => $e->getMessage()]);

            return false;
        }
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
     * Напомнить о лайке не-анкетной сущности (фото, пост UFlow).
     *
     * Лайки анкет идут через liked(), а фото/посты раньше уходили
     * только в колокольчик — в бота ничего не прилетало и владельцы
     * думали, что «лайки не приходят». Гейты те же: тумблер likes
     * + только отошедшему (isAway), дедуп по паре сутки.
     *
     * @param User $actor кто лайкнул
     * @param User $owner владелец сущности
     * @param string $entityLabel что лайкнули («фото», «пост»)
     * @param string $path путь в Mini App для кнопки «Смотреть»
     * @param string $dedupKey уникальный ключ дедупа (сутки)
     * @return void
     */
    public static function entityLiked(User $actor, User $owner, string $entityLabel, string $path, string $dedupKey): void
    {
        $owner = self::resolveRecipient($owner);

        if ($owner === null) {
            return;
        }

        if (! self::canNotify($owner, 'likes')) {
            return;
        }

        if (! $owner->isAway()) {
            self::logSkip($owner, 'likes', 'online');

            return;
        }

        $key = 'tg:entityliked:'.$dedupKey;

        if (Cache::has($key)) {
            self::logSkip($owner, 'likes', 'cooldown');

            return;
        }

        Cache::put($key, true, self::LIKED_COOLDOWN_SECONDS);

        $actorName = trim((string) ($actor->name ?? ''));
        $authorPart = $actorName !== '' ? $actorName : 'Поклонник';
        $entity = trim($entityLabel) !== '' ? trim($entityLabel) : 'запись';

        $text = '❤️ <b>'.self::escape($authorPart).'</b> лайкнул(а): '.self::escape($entity);

        self::send($owner, $text, $path, 'Смотреть');
    }

    /**
     * Записать причину пропуска уведомления (диагностика «не пришло»).
     *
     * Уровень info: пропуски видны в прод-логах по умолчанию, без
     * подъёма LOG_LEVEL=debug — иначе жалобы «в бота ничего не
     * приходит» разбирать не по чему (причины unlinked/blocked/
     * toggle-off/online/cooldown/duplicate).
     *
     * @param User $recipient получатель
     * @param string $kind messages|likes|matches|comments
     * @param string $reason unlinked|blocked|toggle-off|online|duplicate
     * @return void
     */
    private static function logSkip(User $recipient, string $kind, string $reason): void
    {
        try {
            Log::info('telegram notify skipped', [
                'user_id' => (int) ($recipient->id ?? 0),
                'kind' => $kind,
                'reason' => $reason,
            ]);
        } catch (\Throwable) {
            // No-op: диагностика не должна мешать основному потоку.
        }
    }

    /**
     * Пометить, что бот не может писать пользователю (нет /start или блок).
     *
     * Публичный: дергает воркер SendTelegramMessage по итогу Bot API.
     *
     * @param User $recipient получатель
     * @return void
     */
    public static function markBlocked(User $recipient): void
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
     * Публичный: дергает воркер SendTelegramMessage по итогу Bot API.
     *
     * @param User $recipient получатель
     * @return void
     */
    public static function clearBlocked(User $recipient): void
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
