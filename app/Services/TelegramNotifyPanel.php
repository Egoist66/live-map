<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Куда слать уведомления» бота: личка × почта.
 *
 * Два независимых канала:
 * - 💬 Личка — сообщения от бота прямо сюда, с фото автора и кнопкой
 *   в Mini App (сообщения, лайки, мэтчи, комментарии);
 * - 📧 Почта — дубли на основную почту (только сообщения/лайки/мэтчи,
 *   комментариев письмом нет; нужна подтверждённая почта, см. /email).
 * Каждый тип выключается своим тумблером.
 * По умолчанию личка и почта включены.
 *
 * Мастер 🔕 глушит личку разом (почту не трогает).
 * В приложении колокольчик звенит всегда — это не дубль, а inbox.
 */
class TelegramNotifyPanel
{
    /**
     * Собрать текст и клавиатуру каналов.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $master = (bool) ($fresh->telegram_notify_enabled ?? true);

        $pm = [
            'msg' => (bool) ($fresh->telegram_notify_messages ?? true),
            'like' => (bool) ($fresh->telegram_notify_likes ?? true),
            'match' => (bool) ($fresh->telegram_notify_matches ?? true),
            'cmt' => (bool) ($fresh->telegram_notify_comments ?? true),
        ];

        $mail = [
            'msg' => (bool) ($fresh->email_notify_messages ?? true),
            'like' => (bool) ($fresh->email_notify_likes ?? true),
            'match' => (bool) ($fresh->email_notify_matches ?? true),
        ];

        $lines = [];
        $lines[] = '🔔 <b>Куда слать уведомления</b>';
        $lines[] = 'Личка — сообщения бота сюда, почта — дубли на e-mail. Каждый тип отключается отдельно.';
        $lines[] = 'Всё шлём только когда приложение закрыто (ты оффлайн 3+ минуты); колокольчик — всегда.';

        $keyboard = [];

        $keyboard[] = [[
            'text' => ($master ? '✅' : '❌').' 🔕 Личка целиком',
            'callback_data' => 'ntg_all',
        ]];

        $keyboard[] = [[
            'text' => self::toggleLabel('💬 Сообщения', $pm['msg']),
            'callback_data' => 'ntg_msg',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('💞 Лайки', $pm['like']),
            'callback_data' => 'ntg_like',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('🎉 Мэтчи', $pm['match']),
            'callback_data' => 'ntg_match',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('💭 Комментарии', $pm['cmt']),
            'callback_data' => 'ntg_cmt',
        ]];

        $keyboard[] = [[
            'text' => self::toggleLabel('📧💬 Сообщения', $mail['msg']),
            'callback_data' => 'nem_msg',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('📧💞 Лайки', $mail['like']),
            'callback_data' => 'nem_like',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('📧🎉 Мэтчи', $mail['match']),
            'callback_data' => 'nem_match',
        ]];

        $keyboard[] = [
            ['text' => '📧 Моя почта', 'callback_data' => 'go_email'],
            TelegramMenu::openAppButton('🌐 Приложение'),
        ];

        if ($fresh->telegram_blocked_at !== null) {
            $lines[] = '';
            $lines[] = '⚠️ Я не могу вам писать: нажмите /start чтобы разблокировать.';
        }

        if ($fresh->hasTechnicalTelegramEmail()) {
            $lines[] = '';
            $lines[] = '⚠️ Почта техническая — дубли на почту не дойдут, укажите основную через /email.';
        }

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Подпись кнопки-тумблера.
     *
     * @param string $label что переключаем
     * @param bool $enabled включено ли
     * @return string
     */
    private static function toggleLabel(string $label, bool $enabled): string
    {
        $mark = $enabled ? '✅' : '❌';

        return $mark.' '.$label;
    }
}
