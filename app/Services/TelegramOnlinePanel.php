<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Кто онлайн» Telegram-бота (ULove сейчас).
 *
 * Дублирует таб «Активные» из приложения: те, у кого last_seen_at
 * в пределах онлайн-порога. По каждому — короткая строка и кнопки
 * «❤️» (лайк прямо из списка) и «👤» (анкета целиком со свайп-логикой).
 * Пагинация — кнопками, по 5 человек на страницу.
 */
class TelegramOnlinePanel
{
    /**
     * Сколько человек показываем на одной странице.
     */
    public const PER_PAGE = 5;

    /**
     * Собрать текст и клавиатуру страницы онлайна.
     *
     * @param User $user зритель
     * @param int $page страница 1-based
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user, int $page = 1): array
    {
        $fresh = $user->fresh() ?? $user;
        $dating = app(DatingService::class);

        try {
            $result = $dating->active($fresh, self::PER_PAGE, max(1, $page));
        } catch (\Throwable) {
            return self::failed();
        }

        $active = $result['active'] ?? [];
        $total = (int) ($result['total'] ?? 0);
        $current = max(1, (int) ($result['current_page'] ?? 1));
        $last = max(1, (int) ($result['last_page'] ?? 1));

        if ($active === []) {
            return self::empty();
        }

        $lines = [];
        $lines[] = '🟢 <b>Сейчас в ULove: '.$total.'</b>';
        $lines[] = 'Страница '.$current.' из '.$last.' — лайк ставьте кнопкой ❤️ под именем.';
        $lines[] = '';

        $keyboard = [];
        $index = ($current - 1) * self::PER_PAGE;

        foreach ($active as $card) {
            if (! is_array($card)) {
                continue;
            }

            $index++;
            $cardId = (int) ($card['id'] ?? 0);

            if ($cardId <= 0) {
                continue;
            }

            $lines[] = '<b>'.$index.'.</b> '.self::shortLine($card);

            $shortName = mb_substr(trim((string) ($card['name'] ?? 'Без имени')), 0, 12);

            $keyboard[] = [
                ['text' => '❤️ '.$shortName, 'callback_data' => 'on_like:'.$cardId],
                ['text' => '👤', 'callback_data' => 'sw_view:'.$cardId],
            ];
        }

        $pager = [];

        if ($current > 1) {
            $pager[] = ['text' => '◀️ Назад', 'callback_data' => 'on_page:'.($current - 1)];
        }

        if ($current < $last) {
            $pager[] = ['text' => 'Дальше ▶️', 'callback_data' => 'on_page:'.($current + 1)];
        }

        if ($pager !== []) {
            $keyboard[] = $pager;
        }

        $keyboard[] = [
            ['text' => '🔥 Найти мэтч', 'callback_data' => 'sw_find'],
            ['text' => '🔄 Обновить', 'callback_data' => 'on_page:'.$current],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Короткая строка кандидата: имя, возраст, город, цель.
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

        $tail = [];

        $city = trim((string) ($card['city'] ?? ''));

        if ($city !== '') {
            $tail[] = $city;
        }

        $goal = trim((string) ($card['goal'] ?? ''));

        if ($goal !== '') {
            $tail[] = $goal;
        }

        $line = self::esc($title).' 🟢';

        if ($tail !== []) {
            $escaped = array_map(fn (string $part): string => self::esc($part), $tail);
            $line .= ' · '.implode(' · ', $escaped);
        }

        if (! empty($card['liked_me'])) {
            $line .= ' · 💞 лайкнул вас';
        }

        return $line;
    }

    /**
     * Экран пустого онлайна.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    private static function empty(): array
    {
        $text = "🌙 Сейчас в ULove никого нет рядом в сети.\nЗагляните позже или листайте ленту кнопкой ниже — там все анкеты.";

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

    /**
     * Экран ошибки загрузки онлайна.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    private static function failed(): array
    {
        $text = 'Не получилось загрузить онлайн 😕 Попробуйте обновить.';

        $keyboard = [
            [
                ['text' => '🔄 Обновить', 'callback_data' => 'go_online'],
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
