<?php

namespace App\Services;

use App\Jobs\SendTelegramMessage;
use App\Models\Conversation;
use App\Models\Message;
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
 * Письма о людях идут с фото автора через sendPhoto (аватар виден
 * миниатюрой в чате) — сразу понятно, кто пишет/лайкнул.
 * Нет фото — обычный sendMessage, инкогнито/аноним — без фото.
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
     * Фирменная пометка ULove: каждое письмо начинается с неё + контекст
     * (кто, что, где открыть), чтобы уведомление не терялось среди
     * других чатов и было понятно без открытия.
     */
    private const ULOVE_TAG = '💘 <b>ULove</b>';

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
     * @return bool true когда привязан id, мастер и тумблер включены, нет 403
     */
    public static function canNotify(User $recipient, string $kind): bool
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return false;
        }

        if (! (bool) ($recipient->telegram_notify_enabled ?? true)) {
            self::logSkip($recipient, $kind, 'master-off');

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

            try {
                self::scheduleFlush((int) $recipient->id);
            } catch (\Throwable) {
            }

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

        $text = '💬 '.self::ULOVE_TAG.' • <b>'.self::escape($senderName).'</b>: '.self::escape(self::preview($preview));

        $photo = self::actorPhotoUrl($sender);
        $path = '/chat/'.(int) $conversation->id;

        self::sendWithPhoto($recipient, $text, $photo, $path, 'Открыть чат');
    }

    /**
     * Напомнить о новом лайке анкеты.
     *
     * Кнопка ведёт прямо в профиль лайкнувшего (`/users/{id}` — бэк сам
     * разрулит слаг и приватность), а не в общую ленту. Инкогнито (PRO)
     * личность не палит: имя скрыто и кнопка ведёт в ленту свайпов.
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
            $super = $isSuperlike ? ' · суперлайк ⭐' : '';
            $text = '💞 '.self::ULOVE_TAG.' • Вашу анкету лайкнули анонимно'.$super;
            self::send($liked, $text, '/swipes', 'Смотреть');

            return;
        }

        $likerName = trim((string) ($liker->name ?? ''));

        if ($likerName === '') {
            $likerName = 'Поклонник';
        }

        $super = $isSuperlike ? ' · суперлайк ⭐' : '';
        $path = '/users/'.$liker->profileIdentifier();

        $text = '💞 '.self::ULOVE_TAG.' • Вас лайкнул(а): <b>'.self::escape($likerName).'</b>'.$super;

        $photo = self::actorPhotoUrl($liker);

        self::sendWithPhoto($liked, $text, $photo, $path, '👤 Смотреть анкету');
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

            $text = '🎉 '.self::ULOVE_TAG.' • Мэтч! У вас взаимность с <b>'.self::escape($actorName).'</b> — чат открыт, лимиты здесь не действуют.';

            $photo = self::actorPhotoUrl($actor);

            self::sendWithPhoto($recipient, $text, $photo, $path, 'Открыть чат');
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

        $text = '💬 '.self::ULOVE_TAG.' • <b>'.self::escape($authorPart).'</b> прокомментировал(а): '.self::escape($entity)
            .' — «'.self::escape(self::preview($preview)).'»';

        $photo = $anonymous ? null : self::actorPhotoUrl($actor);

        self::sendWithPhoto($recipient, $text, $photo, $path, 'Смотреть');
    }

    /**
     * Дослать в бота сообщения, пропущенные пока пользователь был онлайн.
     *
     * Скип `online` в момент отправки — навсегда: получатель был онлайн
     * (дубль не слали), а потом закрыл Mini App не прочитав — без досылки
     * уведомление терялось. Метод вызывается из offline-beacon
     * (POST /api/chat/offline) и из отложенной задачи FlushTelegramUnread:
     * берёт непрочитанные (read_at NULL — то же, что считает бейдж),
     * свежие (последние сутки), кроме самых новых (grace 60 секунд —
     * realtime-тост ещё может сработать), и шлёт каждое через chatMessage.
     * Гейты и дедуп внутри chatMessage: уже ушедшие ранее отсеются
     * как duplicate, прочитанные в выборку не попадут.
     *
     * @param User $recipient отошедший получатель
     * @param int $limit максимум писем за один уход в оффлайн
     * @param bool $force явный сигнал закрытия: гейт isAway пропускаем
     * @return int сколько сообщений поставлено в обработку
     */
    public static function flushUnread(User $recipient, int $limit = 10, bool $force = false): int
    {
        $recipient = self::resolveRecipient($recipient);

        if ($recipient === null) {
            return 0;
        }

        if (! self::canNotify($recipient, 'messages')) {
            return 0;
        }

        if (! $force && ! $recipient->isAway()) {
            return 0;
        }

        $conversationIds = $recipient->conversations()->pluck('conversations.id');

        if ($conversationIds->isEmpty()) {
            return 0;
        }

        $messages = Message::whereIn('conversation_id', $conversationIds)
            ->where('sender_id', '!=', $recipient->id)
            ->whereNull('read_at')
            ->where('created_at', '>=', now()->subDay())
            ->where('created_at', '<=', now()->subMinute())
            ->orderByDesc('id')
            ->limit(max(1, $limit))
            ->with(['sender:id,name,avatar_path,telegram_photo_url', 'conversation'])
            ->get()
            ->reverse()
            ->values();

        if ($messages->isEmpty()) {
            return 0;
        }

        $processed = 0;

        foreach ($messages as $message) {
            $sender = $message->sender;
            $conversation = $message->conversation;

            if (! $sender || ! $conversation) {
                continue;
            }

            $preview = self::messagePreview($message);

            try {
                self::chatMessage($sender, $recipient, $conversation, $preview, (int) $message->id);
                $processed++;
            } catch (\Throwable $e) {
                Log::warning('telegram flush message failed', ['message_id' => $message->id, 'error' => $e->getMessage()]);
            }
        }

        Log::info('telegram flush unread', ['user_id' => (int) $recipient->id, 'processed' => $processed]);

        return $processed;
    }

    /**
     * Запланировать отложенную досылку непрочитанного после грейса онлайна.
     *
     * Сообщения, пришедшие в 3-минутный грейс после закрытия приложения,
     * в момент отправки скипаются как `online` — их подберёт задача
     * FlushTelegramUnread через 4 минуты, когда грейс уже истечёт и
     * сработают обычные гейты. Дедуп не чаще раза в 5 минут на человека,
     * повторные постановки безопасны: уже доставленное отсекается
     * дедупом внутри chatMessage.
     *
     * @param int $userId id получателя (users.id)
     * @return void
     */
    public static function scheduleFlush(int $userId): void
    {
        if ($userId <= 0) {
            return;
        }

        $key = 'tg:flushscheduled:'.$userId;

        try {
            if (Cache::has($key)) {
                return;
            }

            Cache::put($key, true, 300);
        } catch (\Throwable) {
            return;
        }

        \App\Jobs\FlushTelegramUnread::dispatch($userId)->delay(now()->addMinutes(4));
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
        return self::sendWithPhoto($recipient, $text, null, $path, $buttonLabel);
    }

    /**
     * Поставить письмо с фото автора в очередь Bot API.
     *
     * Фото шлём через sendPhoto (аватар виден миниатюрой в чате),
     * без фото — обычный sendMessage. Нет фото — не ошибка.
     *
     * @param User $recipient получатель
     * @param string $text текст в HTML-разметке (для фото — подпись)
     * @param string|null $photoUrl https-URL аватара автора
     * @param string|null $path путь в Mini App для кнопки
     * @param string|null $buttonLabel подпись кнопки
     * @return bool true когда задача принята в очередь
     */
    public static function sendWithPhoto(User $recipient, string $text, ?string $photoUrl, ?string $path = null, ?string $buttonLabel = null): bool
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

        $photo = self::cleanPhotoUrl($photoUrl);

        return self::dispatchMessage((int) $recipient->id, $text, $buttons, $photo);
    }

    /**
     * URL аватара автора для sendPhoto.
     *
     * Берём avatar_url (аватар или telegram_photo_url), но только
     * публичный https — локальный http Telegram не скачает, тогда
     * уйдём в текстовый sendMessage без фото.
     *
     * @param User|null $actor автор события
     * @return string|null https-URL фото или null
     */
    private static function actorPhotoUrl(?User $actor): ?string
    {
        if ($actor === null) {
            return null;
        }

        $resolved = self::resolveActor($actor);

        if ($resolved === null) {
            return null;
        }

        try {
            $url = trim((string) ($resolved->avatar_url ?? ''));
        } catch (\Throwable) {
            return null;
        }

        return self::cleanPhotoUrl($url);
    }

    /**
     * Почистить URL фото: только публичный https до 512 символов.
     *
     * @param string|null $raw сырой URL
     * @return string|null чистый URL или null
     */
    private static function cleanPhotoUrl(?string $raw): ?string
    {
        $clean = trim((string) $raw);

        if ($clean === '') {
            return null;
        }

        if (! str_starts_with($clean, 'https://')) {
            return null;
        }

        if (mb_strlen($clean) > 512) {
            return null;
        }

        return $clean;
    }

    /**
     * Догрузить колонки аватара автора, если модель урезана select().
     *
     * avatar_url строится из avatar_path + telegram_photo_url: без них
     * accessor вернёт null и фото потеряется, хотя оно есть.
     *
     * @param User $actor возможно урезанная модель автора
     * @return User|null полная модель или null
     */
    private static function resolveActor(User $actor): ?User
    {
        $attributes = $actor->getAttributes();

        $hasAvatar = array_key_exists('avatar_path', $attributes);
        $hasTgPhoto = array_key_exists('telegram_photo_url', $attributes);

        if ($hasAvatar && $hasTgPhoto) {
            return $actor;
        }

        try {
            $fresh = $actor->fresh(['id', 'name', 'avatar_path', 'telegram_photo_url']);

            return $fresh ?? $actor;
        } catch (\Throwable) {
            return $actor;
        }
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
     * @param string|null $photoUrl https-URL фото для sendPhoto или null для sendMessage
     * @return bool true когда задача принята (очередь или прямая отправка)
     */
    private static function dispatchMessage(int $userId, string $text, array $buttons, ?string $photoUrl = null): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $photo = self::cleanPhotoUrl($photoUrl);

        try {
            SendTelegramMessage::dispatch($userId, $text, $buttons, $photo);

            return true;
        } catch (\Throwable $e) {
            Log::warning('telegram dispatch failed', ['user_id' => $userId, 'error' => $e->getMessage()]);
        }

        try {
            $outcome = SendTelegramMessage::attempt($userId, $text, $buttons, $photo);

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
     * Кнопок две: автор (профиль лайкнувшего) и сама сущность.
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

        $text = '❤️ '.self::ULOVE_TAG.' • <b>'.self::escape($authorPart).'</b> лайкнул(а): '.self::escape($entity);

        $rows = [];

        $authorButton = self::button('/users/'.$actor->profileIdentifier(), '👤 Автор');

        if ($authorButton !== null) {
            $rows[] = [$authorButton];
        }

        $entityButton = self::button($path, '👀 Смотреть');

        if ($entityButton !== null) {
            $rows[] = [$entityButton];
        }

        $photo = self::actorPhotoUrl($actor);

        self::dispatchMessage((int) $owner->id, $text, $rows, $photo);
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
     * Превью сообщения для TG: текст, репост или вложение.
     *
     * Зеркалит логику MessageController::pushToRecipients, чтобы flush
     * слал те же тексты, что и отправка в момент события.
     *
     * @param Message $message сообщение
     * @return string превью до 200 символов
     */
    private static function messagePreview(Message $message): string
    {
        $text = trim((string) $message->body);

        if ($text === '' && $message->shared_post_type) {
            $isDistrict = $message->shared_post_type === 'district';
            $text = $isDistrict ? '📰 Новость района' : '📝 Пост';
        }

        if ($text === '' && $message->attachment_path) {
            $isVoice = $message->attachment_kind === 'voice';

            if ($isVoice) {
                $text = '🎤 Голосовое сообщение';

                if ($message->attachment_duration) {
                    $text .= ' ('.$message->attachment_duration.' c)';
                }
            } else {
                $label = $message->attachment_name ? ' '.$message->attachment_name : '';
                $isImage = $message->attachment_kind === 'image';
                $prefix = $isImage ? '📷 Фото' : '📎 Файл';
                $text = $prefix.$label;
            }
        }

        return mb_substr($text, 0, 200);
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
