<?php

namespace App\Services;

use App\Models\User;

/**
 * Тексты воронки удаления: приманка + неделя PRO + 14 дней на возврат.
 *
 * Тон — тёплый, без guilt-trip перегиба: честно говорим что нам
 * будет плохо без пользователя, дарим неделю PRO и обещаем вернуть
 * всё одним тапом в течение 2 недель.
 */
class TelegramDeletionFlow
{
    /**
     * Первая приманка: «нам будет плохо без вас + неделя PRO».
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function bait(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $name = trim((string) ($fresh->name ?? ''));

        $hello = $name !== '' ? self::esc($name).', ' : '';

        $text = '💔 '.$hello.'нам будет очень плохо без вас…'
            ."\n\n"
            .'Давайте так: вы остаётесь, а мы дарим вам <b>неделю PRO бесплатно</b> 🎁 — безлимитные свайпы, суперлайки и невидимка.'
            ."\n\n"
            .'Если всё же уйдёте — анкета сразу станет невидимой, а <b>все данные сохраним ещё 14 дней</b>. Вернётесь одним тапом — всё будет на месте.'
            ."\n\n"
            .'Точно удаляем?';

        $keyboard = [
            [
                ['text' => '💚 Остаюсь, хочу PRO', 'callback_data' => 'del_cancel'],
            ],
            [
                ['text' => '😔 Да, удалить', 'callback_data' => 'del_yes'],
            ],
        ];

        return ['text' => $text, 'keyboard' => $keyboard];
    }

    /**
     * Подтверждение после удаления: что дальше.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function scheduled(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $days = $fresh->deletionDaysLeft() ?? AccountDeletionService::GRACE_DAYS;

        $hasPro = false;

        try {
            $hasPro = $fresh->deletion_pro_until !== null && $fresh->deletion_pro_until->isFuture();
        } catch (\Throwable) {
            $hasPro = false;
        }

        $lines = [];
        $lines[] = '😢 Анкета скрыта. Вас уже никто не видит.';
        $lines[] = '';

        if ($hasPro) {
            $lines[] = '🎁 Неделя <b>PRO уже включена</b> — заглядывайте, вдруг понравится.';
            $lines[] = '';
        }

        $lines[] = '⏳ Полное удаление — через <b>'.$days.' дн.</b> Тогда сотрём всё из базы без возврата.';
        $lines[] = '💚 Передумаете — жмите кнопку, вернём всё одним тапом.';

        $keyboard = [
            [
                ['text' => '💚 Вернуть профиль', 'callback_data' => 'del_cancel'],
            ],
            [
                TelegramSessionsPanel::openAppButton('🌐 Открыть приложение'),
            ],
        ];

        return ['text' => implode("\n", $lines), 'keyboard' => $keyboard];
    }

    /**
     * Текст возврата: «ура, вы дома».
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function restored(): array
    {
        $text = '🎉 Ура! Вы снова с нами.'
            ."\n"
            .'Анкета видима, все чаты, друзья и фото на месте. Подаренный PRO остаётся до конца недели — пользуйтесь 💎.';

        $keyboard = [
            [
                ['text' => '👤 Моя анкета', 'callback_data' => 'prof_refresh'],
                TelegramSessionsPanel::openAppButton('🌐 В приложение'),
            ],
        ];

        return ['text' => $text, 'keyboard' => $keyboard];
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
