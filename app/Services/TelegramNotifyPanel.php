<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель уведомлений бота: конечный список из 6 типов.
 *
 * Каждый тумблер — целый тип целиком (бот + дубль на почту, где он есть):
 * сообщения, лайки, мэтчи, комментарии, гости профиля, новости приложения.
 * Без мастеров и без дублей «то же самое по второму разу». Комментарии,
 * гости и новости письмом не шлём — у них только бот. Для почты нужна
 * подтверждённая основная почта (см. /email), техническая
 * `tg_*@telegram.local` не подойдёт. Гости профиля срабатывают только
 * на PRO и выше (там же тумблер в приватности ULove).
 *
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

        $types = self::types($fresh);

        $lines = [];
        $lines[] = '🔔 <b>Какие уведомления слать</b>';
        $lines[] = 'Каждый пункт — целый тип: бот сюда + дубль на почту. Выключил — тихо везде.';
        $lines[] = 'Шлём только когда приложение закрыто (ты оффлайн 3+ минуты); колокольчик в приложении — всегда.';

        $keyboard = [];

        foreach ($types as $type) {
            $keyboard[] = [[
                'text' => self::toggleLabel($type['label'], $type['enabled']),
                'callback_data' => $type['callback'],
            ]];
        }

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
     * Конечный список типов уведомлений.
     *
     * Включённым тип считается, когда включён бот (и почта, где она есть):
     * тап по пункту включает/глушит тип целиком, дублей нет.
     *
     * @param User $user владелец
     * @return array<int, array{label:string, callback:string, enabled:bool}>
     */
    public static function types(User $user): array
    {
        $botMessages = (bool) ($user->telegram_notify_messages ?? true);
        $botLikes = (bool) ($user->telegram_notify_likes ?? true);
        $botMatches = (bool) ($user->telegram_notify_matches ?? true);
        $botComments = (bool) ($user->telegram_notify_comments ?? true);
        $botNews = (bool) ($user->telegram_notify_news ?? true);
        $visitors = (bool) ($user->notify_profile_visitors ?? true);

        $mailMessages = (bool) ($user->email_notify_messages ?? true);
        $mailLikes = (bool) ($user->email_notify_likes ?? true);
        $mailMatches = (bool) ($user->email_notify_matches ?? true);

        return [
            ['label' => '💬 Сообщения', 'callback' => 'ntg_msg', 'enabled' => $botMessages && $mailMessages],
            ['label' => '💞 Лайки', 'callback' => 'ntg_like', 'enabled' => $botLikes && $mailLikes],
            ['label' => '🎉 Мэтчи', 'callback' => 'ntg_match', 'enabled' => $botMatches && $mailMatches],
            ['label' => '💭 Комментарии', 'callback' => 'ntg_cmt', 'enabled' => $botComments],
            ['label' => '👀 Гости профиля (PRO)', 'callback' => 'ntg_visit', 'enabled' => $visitors],
            ['label' => '📰 Новости приложения', 'callback' => 'ntg_news', 'enabled' => $botNews],
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
