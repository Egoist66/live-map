<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Сброс просмотренных» Telegram-бота.
 *
 * Дублирует кнопку сброса истории свайпов из приложения с тем же
 * тарифным правилом: Free — один раз, PRO/Premium/Business — безлимит.
 * Сброс чистит только историю like/pass — мэтчи и чаты остаются.
 */
class TelegramResetPanel
{
    /**
     * Собрать текст и клавиатуру панели сброса.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;
        $dating = app(DatingService::class);

        $canReset = $dating->canResetHistory($fresh);
        $isPro = $fresh->isPro();
        $planLabel = TelegramInsights::planLabel((string) ($fresh->effectivePlan() ?? 'free'));

        $lines = [];
        $lines[] = '🔄 <b>Сброс просмотренных</b>';
        $lines[] = '';
        $lines[] = 'Лента снова покажет всех, кого вы уже оценили. Мэтчи и чаты не трогаем — только историю свайпов.';
        $lines[] = '';
        $lines[] = 'Ваш тариф: <b>'.$planLabel.'</b> — '.($isPro ? 'сбросов безлимит ♾️' : 'доступен <b>один</b> сброс');

        if ($canReset) {
            $lines[] = '';
            $lines[] = 'Готовы? Действие необратимо.';
        } else {
            $lines[] = '';
            $lines[] = '⚠️ Вы уже использовали свой сброс. Дальше — PRO без ограничений (оплата в разработке).';
        }

        $keyboard = [];

        if ($canReset) {
            $keyboard[] = [
                ['text' => '🔄 Сбросить просмотренные', 'callback_data' => 'reset_do'],
            ];
        }

        $keyboard[] = [
            ['text' => '🔥 Найти мэтч', 'callback_data' => 'sw_find'],
            ['text' => '💎 Мой тариф', 'callback_data' => 'go_plan'],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }
}
