<?php

namespace App\Services;

/**
 * Отправка карточек бота с фото или без.
 *
 * Текстовую панель правим через editMessageText, подпись под фото —
 * через editMessageCaption: это разные методы Bot API, тип текущего
 * сообщения запоминаем в кеше при отправке (photo:{chat}:{message}=1).
 * Промахнулись типом — не роняем чат, а шлём карточку новым сообщением.
 */
class TelegramCardSender
{
    /**
     * Ключ типа сообщения (фото или текст).
     *
     * @param int $chatId куда
     * @param int $messageId что
     * @return string
     */
    public static function typeKey(int $chatId, int $messageId): string
    {
        return 'tg:msg:type:'.$chatId.':'.$messageId;
    }

    /**
     * Отправить карточку новым сообщением: с фото когда есть https.
     *
     * @param int $chatId куда
     * @param string|null $photoUrl https-фото либо null
     * @param string $text текст/подпись в HTML-разметке
     * @param array<int, array<int, array<string, mixed>>> $keyboard ряды кнопок
     * @return void
     */
    public static function sendCard(int $chatId, ?string $photoUrl, string $text, array $keyboard = []): void
    {
        if ($photoUrl !== null) {
            $sent = TelegramBotApi::sendPhoto($chatId, $photoUrl, $text, $keyboard);

            if ($sent !== null) {
                self::rememberType($chatId, (int) ($sent['message_id'] ?? 0), true);

                return;
            }
        }

        $sent = TelegramBotApi::sendMessage($chatId, $text, $keyboard);

        if (is_array($sent)) {
            self::rememberType($chatId, (int) ($sent['message_id'] ?? 0), false);
        }
    }

    /**
     * Перерисовать текстовую панель из любого состояния чата.
     *
     * Кнопка «◀️ Меню» (и вся навигация go_*) висит и под фото-карточками
     * режима «Найти мэтч»: editMessageText по фото молча не срабатывает,
     * и пользователь застревал в свайпах. Здесь при неудаче правки
     * старую карточку удаляем и шлём панель новым сообщением —
     * выход из любого экрана работает всегда.
     *
     * @param int $chatId куда
     * @param int $messageId что перерисовать
     * @param string $text новый текст в HTML-разметке
     * @param array<int, array<int, array<string, mixed>>> $keyboard новые кнопки
     * @return void
     */
    public static function redrawText(int $chatId, int $messageId, string $text, array $keyboard = []): void
    {
        $ok = TelegramBotApi::editPanel($chatId, $messageId, $text, $keyboard);

        if ($ok) {
            self::rememberType($chatId, $messageId, false);

            return;
        }

        try {
            TelegramBotApi::deleteMessage($chatId, $messageId);
        } catch (\Throwable) {
        }

        self::sendCard($chatId, null, $text, $keyboard);
    }

    /**
     * Перерисовать карточку: подпись под фото или текст панели.
     *
     * @param int $chatId куда
     * @param int $messageId что
     * @param string|null $photoUrl https-фото новой карточки либо null
     * @param string $text новый текст/подпись
     * @param array<int, array<int, array<string, mixed>>> $keyboard новые кнопки
     * @return void
     */
    public static function redraw(int $chatId, int $messageId, ?string $photoUrl, string $text, array $keyboard = []): void
    {
        $wasPhoto = self::wasPhoto($chatId, $messageId);

        if ($photoUrl !== null && $wasPhoto) {
            $ok = TelegramBotApi::editCaption($chatId, $messageId, $text, $keyboard);

            if ($ok) {
                return;
            }
        }

        if ($photoUrl === null && ! $wasPhoto) {
            $ok = TelegramBotApi::editPanel($chatId, $messageId, $text, $keyboard);

            if ($ok) {
                return;
            }
        }

        try {
            TelegramBotApi::deleteMessage($chatId, $messageId);
        } catch (\Throwable) {
        }

        self::sendCard($chatId, $photoUrl, $text, $keyboard);
    }

    /**
     * Запомнить тип отправленного сообщения на сутки.
     *
     * @param int $chatId куда
     * @param int $messageId что
     * @param bool $isPhoto фото ли
     * @return void
     */
    private static function rememberType(int $chatId, int $messageId, bool $isPhoto): void
    {
        if ($chatId <= 0 || $messageId <= 0) {
            return;
        }

        try {
            \Illuminate\Support\Facades\Cache::put(self::typeKey($chatId, $messageId), $isPhoto ? 1 : 0, 86400);
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Было ли сообщение фото-карточкой.
     *
     * Не знаем (кеш протух, бот перезапущен) — считаем текстом:
     * editMessageText по фото просто не сработает и уйдём в фолбэк
     * с новым сообщением, чат не роняем.
     *
     * @param int $chatId куда
     * @param int $messageId что
     * @return bool
     */
    private static function wasPhoto(int $chatId, int $messageId): bool
    {
        try {
            return (bool) \Illuminate\Support\Facades\Cache::get(self::typeKey($chatId, $messageId), 0);
        } catch (\Throwable) {
            return false;
        }
    }
}
