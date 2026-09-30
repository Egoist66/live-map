<?php

namespace App\Services;

use App\Models\User;

/**
 * Карточка «Моя анкета» для Telegram-бота.
 *
 * Показывает имя, тариф, видимость и живые счётчики, а кнопки
 * дают скрыть/вернуть анкету и прыгнуть в Mini App одним тапом.
 */
class TelegramProfilePanel
{
    /**
     * Собрать текст и клавиатуру карточки профиля.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $name = trim((string) ($fresh->name ?? ''));

        if ($name === '') {
            $name = 'Без имени';
        }

        $planLabel = TelegramInsights::planLabel((string) ($fresh->effectivePlan() ?? 'free'));

        $admirers = TelegramInsights::admirers($fresh);
        $matches = TelegramInsights::matches($fresh);
        $unread = TelegramInsights::unreadCount($fresh);

        $lines = [];
        $lines[] = '👤 <b>'.self::esc($name).'</b> · '.$planLabel;

        if ($fresh->isPendingDeletion()) {
            $days = $fresh->deletionDaysLeft() ?? 0;
            $lines[] = '⏳ Профиль удаляется через <b>'.$days.' дн.</b> — всё ещё можно вернуться!';
        } elseif ($fresh->isProfileHidden()) {
            $lines[] = '🙈 Анкета <b>скрыта</b> — вас никто не видит. Кайфуйте в тени.';
        } else {
            $lines[] = '👀 Анкета <b>видна</b> — вас находят в ленте и поиске.';
        }

        $lines[] = '';
        $lines[] = '💞 Лайков: <b>'.$admirers['total'].'</b> · 🎉 Мэтчей: <b>'.$matches['total'].'</b> · 💬 Новых: <b>'.$unread.'</b>';

        if ($admirers['names'] !== []) {
            $escaped = array_map(fn (string $n): string => self::esc($n), array_slice($admirers['names'], 0, 3));
            $lines[] = 'Последние симпатии: '.implode(', ', $escaped);
        }

        $keyboard = [];

        if ($fresh->isPendingDeletion()) {
            $keyboard[] = [
                ['text' => '💚 Остаться (отменить удаление)', 'callback_data' => 'del_cancel'],
            ];
        } elseif ($fresh->isProfileHidden()) {
            $keyboard[] = [
                ['text' => '👀 Вернуть анкету', 'callback_data' => 'prof_show'],
            ];
        } else {
            $keyboard[] = [
                ['text' => '🙈 Скрыть анкету', 'callback_data' => 'prof_hide'],
            ];
        }

        $keyboard[] = [
            ['text' => '💞 Лайки', 'callback_data' => 'go_likes'],
            ['text' => '🎉 Мэтчи', 'callback_data' => 'go_matches'],
        ];

        $keyboard[] = [
            ['text' => '🔑 Пароль для входа с ПК', 'callback_data' => 'go_password'],
        ];

        $keyboard[] = [
            ['text' => '🔄 Обновить', 'callback_data' => 'prof_refresh'],
            TelegramMenu::openAppButton('🌐 Открыть анкету'),
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private static function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
