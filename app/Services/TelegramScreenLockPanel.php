<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Сброс скринлокера» в Telegram-боте.
 *
 * Показывается только тем, у кого локер включён (`is_sl_active`).
 * Владение Telegram-аккаунтом уже доказывает владение аккаунтом ULove,
 * поэтому отдельный код не нужен — подтверждаем кнопкой и стираем
 * локальный код на всех устройствах через realtime-метку.
 */
class TelegramScreenLockPanel
{
    /**
     * Собрать экран подтверждения сброса.
     *
     * @param User $user владелец аккаунта
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $lines = [];
        $lines[] = '🔓 <b>Сброс скринлокера</b>';
        $lines[] = '';
        $lines[] = 'Скринлокер включён на одном из твоих устройств. Сброс стирает код блокировки на всех устройствах, где ты вошёл в этот аккаунт.';
        $lines[] = '';
        $lines[] = 'После сброса в приложении снова попросят задать код, если захочешь включить защиту.';

        $keyboard = [];

        if ((bool) ($fresh->is_sl_active ?? false)) {
            $keyboard[] = [
                ['text' => '🔓 Сбросить код', 'callback_data' => 'sl_reset'],
            ];
        } else {
            $lines[] = '';
            $lines[] = 'Сейчас скринлокер выключен — сбрасывать нечего.';
        }

        $keyboard[] = [
            ['text' => '🌐 Открыть приложение', 'callback_data' => 'go_menu'],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экран после успешного сброса.
     *
     * @param User $user владелец аккаунта
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function done(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $lines = [];
        $lines[] = '✅ <b>Скринлокер сброшен</b>';
        $lines[] = '';
        $lines[] = 'Код блокировки стёрт на всех устройствах. Если приложение сейчас открыто, экран разблокируется автоматически — иначе после следующего запуска.';
        $lines[] = '';
        $lines[] = 'Можно задать новый код в настройках приложения.';

        $keyboard = [
            [
                ['text' => '⚙️ Настройки в приложении', 'callback_data' => 'go_menu'],
            ],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }
}
