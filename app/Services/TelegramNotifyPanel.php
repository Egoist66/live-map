<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель уведомлений бота: 4 тумблера одним экраном.
 *
 * Тумблеры живут и в Mini App (Настройки → Приложение), но из бота
 * их переключать быстрее — не надо открывать приложение.
 */
class TelegramNotifyPanel
{
    /**
     * Собрать текст и клавиатуру тумблеров.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $messages = (bool) ($fresh->telegram_notify_messages ?? true);
        $likes = (bool) ($fresh->telegram_notify_likes ?? true);
        $matches = (bool) ($fresh->telegram_notify_matches ?? true);
        $comments = (bool) ($fresh->telegram_notify_comments ?? true);

        $lines = [];
        $lines[] = '🔔 <b>Уведомления бота</b>';
        $lines[] = 'Что присылать в личку, когда Mini App закрыт:';

        $keyboard = [];
        $keyboard[] = [[
            'text' => self::toggleLabel('💬 Сообщения', $messages),
            'callback_data' => 'ntg_msg',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('💞 Лайки', $likes),
            'callback_data' => 'ntg_like',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('🎉 Мэтчи', $matches),
            'callback_data' => 'ntg_match',
        ]];
        $keyboard[] = [[
            'text' => self::toggleLabel('💭 Комментарии', $comments),
            'callback_data' => 'ntg_cmt',
        ]];

        $keyboard[] = [
            TelegramMenu::openAppButton('🌐 Приложение'),
        ];

        if ($fresh->telegram_blocked_at !== null) {
            $lines[] = '';
            $lines[] = '⚠️ Я не могу вам писать: нажмите /start чтобы разблокировать.';
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
