<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Куда слать уведомления» бота: 3 канала × типы событий.
 *
 * Каналы независимы и комбинируются как угодно:
 * - 🤖 Чат бота — служебные карточки с фото и кнопками (как раньше);
 * - 📧 Почта — дубли на основную почту (только сообщения/лайки/мэтчи,
 *   комментариев письмом нет; нужна подтверждённая почта, см. /email);
 * - 💬 Личка — короткие личные дубли в этот же чат (Bot API пишет
 *   только сюда): личный стиль с ULove-контекстом, чтобы не терялось.
 * По умолчанию включены бот и почта, личка выключена.
 *
 * Мастер 📩 глушит оба Telegram-канала разом (почту не трогает).
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

        $bot = [
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

        $dm = [
            'msg' => (bool) ($fresh->telegram_dm_messages ?? false),
            'like' => (bool) ($fresh->telegram_dm_likes ?? false),
            'match' => (bool) ($fresh->telegram_dm_matches ?? false),
            'cmt' => (bool) ($fresh->telegram_dm_comments ?? false),
        ];

        $lines = [];
        $lines[] = '🔔 <b>Куда слать уведомления</b>';
        $lines[] = 'Каждый тип — в свой канал: бот, почта, личка. Комбинируйте.';
        $lines[] = 'Всё шлём только когда Mini App закрыт; колокольчик — всегда.';

        $keyboard = [];

        $keyboard[] = [[
            'text' => ($master ? '✅' : '❌').' 📩 Telegram (бот + личка)',
            'callback_data' => 'ntg_all',
        ]];

        $keyboard[] = [[
            'text' => self::toggleLabel('🤖💬 Сообщения', $bot['msg']),
            'callback_data' => 'ntg_msg',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('🤖💞 Лайки', $bot['like']),
            'callback_data' => 'ntg_like',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('🤖🎉 Мэтчи', $bot['match']),
            'callback_data' => 'ntg_match',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('🤖💭 Комментарии', $bot['cmt']),
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

        $keyboard[] = [[
            'text' => self::toggleLabel('💬💬 Сообщения', $dm['msg']),
            'callback_data' => 'ndm_msg',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('💬💞 Лайки', $dm['like']),
            'callback_data' => 'ndm_like',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('💬🎉 Мэтчи', $dm['match']),
            'callback_data' => 'ndm_match',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('💬💭 Комментарии', $dm['cmt']),
            'callback_data' => 'ndm_cmt',
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
