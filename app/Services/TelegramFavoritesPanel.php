<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Избранное» Telegram-бота (лайкнутые без мэтча).
 *
 * Дублирует таб «Избранное» из приложения с лимитом по тарифу:
 * Free — 3, Pro — 5, Premium/Business — 15. По каждому показываем,
 * можно ли написать (мэтч/друзья/приватность), убрать — кнопкой ❌.
 * Лишние сверх лимита лайки никуда не деваются: они ждут мэтча,
 * здесь видны только свежие по лимиту — как в приложении.
 */
class TelegramFavoritesPanel
{
    /**
     * Сколько избранных показываем на одной странице.
     */
    public const PER_PAGE = 5;

    /**
     * Собрать текст и клавиатуру страницы избранного.
     *
     * @param User $user владелец
     * @param int $page страница 1-based
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user, int $page = 1): array
    {
        $fresh = $user->fresh() ?? $user;
        $dating = app(DatingService::class);

        try {
            $result = $dating->favorites($fresh, max(1, $page), self::PER_PAGE);
        } catch (\Throwable) {
            return self::failed();
        }

        $favorites = $result['favorites'] ?? [];
        $limit = (int) ($result['limit'] ?? 0);
        $current = max(1, (int) ($result['current_page'] ?? 1));
        $last = max(1, (int) ($result['last_page'] ?? 1));
        $total = (int) ($result['total'] ?? 0);

        $planLabel = TelegramInsights::planLabel((string) ($fresh->effectivePlan() ?? 'free'));

        if ($favorites === []) {
            $text = "⭐ <b>Избранное пусто</b> (тариф {$planLabel}, мест: <b>{$limit}</b>).\nЛайкайте анкеты кнопкой 🔥 «Найти мэтч» — они появятся здесь до взаимности.";

            $keyboard = [
                [
                    ['text' => '🔥 Найти мэтч', 'callback_data' => 'sw_find'],
                    TelegramMenu::openAppButton('🌐 Открыть ULove'),
                ],
            ];

            return [
                'text' => $text,
                'keyboard' => TelegramMenu::withNav($keyboard),
            ];
        }

        $lines = [];
        $lines[] = "⭐ <b>Избранное: {$total} из {$limit}</b> (тариф {$planLabel})";
        $lines[] = 'Страница '.$current.' из '.$last.'. ✉️ — написать можно, 🔇 — пока закрыто.';
        $lines[] = '';

        $keyboard = [];
        $index = ($current - 1) * self::PER_PAGE;

        foreach ($favorites as $card) {
            if (! is_array($card)) {
                continue;
            }

            $cardId = (int) ($card['id'] ?? 0);

            if ($cardId <= 0) {
                continue;
            }

            $index++;
            $candidate = User::find($cardId);

            $writeMark = '✉️';
            $writeHint = '';

            if ($candidate !== null) {
                $reason = $fresh->messageBlockReason($candidate);

                if ($reason !== null) {
                    $writeMark = '🔇';
                    $writeHint = ' — '.self::shortReason($reason);
                }
            }

            $lines[] = '<b>'.$index.'.</b> '.$writeMark.' '.self::shortLine($card).$writeHint;

            $shortName = mb_substr(trim((string) ($card['name'] ?? 'Без имени')), 0, 12);

            $keyboard[] = [
                ['text' => '👤 '.$shortName, 'callback_data' => 'sw_view:'.$cardId],
                ['text' => '❌ Убрать', 'callback_data' => 'fav_del:'.$cardId],
            ];
        }

        $pager = [];

        if ($current > 1) {
            $pager[] = ['text' => '◀️ Назад', 'callback_data' => 'fav_page:'.($current - 1)];
        }

        if ($current < $last) {
            $pager[] = ['text' => 'Дальше ▶️', 'callback_data' => 'fav_page:'.($current + 1)];
        }

        if ($pager !== []) {
            $keyboard[] = $pager;
        }

        $keyboard[] = [
            ['text' => '🔥 Найти мэтч', 'callback_data' => 'sw_find'],
            TelegramMenu::openAppButton('💬 Открыть чаты'),
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Короткая строка избранного: имя, возраст, город.
     *
     * @param array<string, mixed> $card карточка из DatingService
     * @return string
     */
    private static function shortLine(array $card): string
    {
        $name = trim((string) ($card['name'] ?? 'Без имени'));
        $title = $name;
        $age = $card['age'] ?? null;

        if ($age !== null) {
            $title .= ', '.$age;
        }

        $city = trim((string) ($card['city'] ?? ''));

        if ($city !== '') {
            $title .= ' · '.$city;
        }

        return self::esc($title);
    }

    /**
     * Короткая причина «писать нельзя» (первые 60 символов).
     *
     * @param string $reason полная причина из User::messageBlockReason
     * @return string
     */
    private static function shortReason(string $reason): string
    {
        $clean = trim($reason);

        if (mb_strlen($clean) > 60) {
            $clean = mb_substr($clean, 0, 60).'…';
        }

        return self::esc($clean);
    }

    /**
     * Экран ошибки загрузки избранного.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    private static function failed(): array
    {
        $text = 'Не получилось загрузить избранное 😕 Попробуйте обновить.';

        $keyboard = [
            [
                ['text' => '🔄 Обновить', 'callback_data' => 'go_fav'],
            ],
        ];

        return [
            'text' => $text,
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
