<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Панель «📝 Заметки» Telegram-бота — то же «Избранное», что в приложении.
 *
 * Заметки хранятся сжатыми (gzip) и зашифрованными (AES-256-GCM) — бот
 * читает их через SavedNotesService, наружу уходит только открытый текст
 * владельцу в личку. Добавление: кнопка «➕ Добавить» ставит ожидание на
 * 10 минут, следующее обычное сообщение сохраняем заметкой; короткий текст
 * можно слать сразу командой `/notes <текст>`. Удаление — кнопкой 🗑
 * под каждой заметкой (callback `notes_del:{id}` короче 64 байт).
 */
class TelegramNotesPanel
{
    /**
     * Сколько заметок показываем на одной странице.
     */
    public const PER_PAGE = 5;

    /**
     * Ключ ожидания текста заметки в кэше.
     *
     * @param int $telegramId telegram_id владельца
     * @return string
     */
    public static function waitKey(int $telegramId): string
    {
        return 'tg:notes:wait:'.$telegramId;
    }

    /**
     * Ждём ли текст заметки от этого telegram_id.
     *
     * @param int $telegramId telegram_id владельца
     * @return bool
     */
    public static function isWait(int $telegramId): bool
    {
        if ($telegramId <= 0) {
            return false;
        }

        try {
            return (bool) Cache::get(self::waitKey($telegramId), false);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Включить ожидание текста заметки на 10 минут.
     *
     * @param int $telegramId telegram_id владельца
     * @return void
     */
    public static function rememberWait(int $telegramId): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::put(self::waitKey($telegramId), true, 600);
        } catch (\Throwable) {
        }
    }

    /**
     * Снять ожидание текста заметки.
     *
     * @param int $telegramId telegram_id владельца
     * @return void
     */
    public static function forgetWait(int $telegramId): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::forget(self::waitKey($telegramId));
        } catch (\Throwable) {
        }
    }

    /**
     * Экран-приглашение прислать текст заметки.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function ask(): array
    {
        $text = "📝 <b>Новая заметка</b>\nПришлите следующим сообщением текст, ссылку — что угодно. Сохраню в «Избранное», найдёте и в приложении, и здесь.";

        $keyboard = [
            [
                ['text' => '◀️ К заметкам', 'callback_data' => 'go_notes'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Собрать текст и клавиатуру страницы заметок.
     *
     * @param User $user владелец
     * @param int $page страница 1-based
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user, int $page = 1): array
    {
        $fresh = $user->fresh() ?? $user;

        try {
            $result = app(SavedNotesService::class)->latest($fresh, max(1, $page), self::PER_PAGE);
        } catch (\Throwable) {
            return self::failed();
        }

        $notes = $result['notes'] ?? [];
        $current = max(1, (int) ($result['current_page'] ?? 1));
        $last = max(1, (int) ($result['last_page'] ?? 1));
        $total = (int) ($result['total'] ?? 0);

        $keyboard = [
            [
                ['text' => '➕ Добавить', 'callback_data' => 'notes_add'],
            ],
        ];

        if ($notes === []) {
            $text = "📝 <b>Заметок пока нет</b>.\nШлите сюда ссылки, мысли, списки — всё сложится в «Избранное» и будет ждать в приложении. Можно и командой: <code>/notes купить молоко</code>.";

            return [
                'text' => $text,
                'keyboard' => TelegramMenu::withNav($keyboard),
            ];
        }

        $lines = [];
        $lines[] = "📝 <b>Заметки: {$total}</b> (стр. {$current} из {$last})";
        $lines[] = 'Удалить — кнопкой 🗑 под заметкой.';
        $lines[] = '';

        $index = ($current - 1) * self::PER_PAGE;

        foreach ($notes as $note) {
            if (! is_array($note)) {
                continue;
            }

            $noteId = (int) ($note['id'] ?? 0);

            if ($noteId <= 0) {
                continue;
            }

            $index++;
            $line = '<b>'.$index.'.</b> '.self::esc(self::short((string) ($note['body'] ?? '')));
            $attachName = is_array($note['attachment'] ?? null) ? (string) ($note['attachment']['name'] ?? '') : '';
            if ($attachName !== '') {
                $line .= ' 📎 '.self::esc($attachName);
            }
            $lines[] = $line;

            $keyboard[] = [
                ['text' => '🗑 Убрать №'.$index, 'callback_data' => 'notes_del:'.$noteId],
            ];
        }

        $pager = [];

        if ($current > 1) {
            $pager[] = ['text' => '◀️ Назад', 'callback_data' => 'notes_page:'.($current - 1)];
        }

        if ($current < $last) {
            $pager[] = ['text' => 'Дальше ▶️', 'callback_data' => 'notes_page:'.($current + 1)];
        }

        if ($pager !== []) {
            $keyboard[] = $pager;
        }

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экран ошибки загрузки заметок.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    private static function failed(): array
    {
        $text = 'Не получилось загрузить заметки 😕 Попробуйте обновить.';

        $keyboard = [
            [
                ['text' => '🔄 Обновить', 'callback_data' => 'go_notes'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Короткий текст заметки для списка (первые 200 символов, в одну строку).
     *
     * @param string $body открытый текст
     * @return string
     */
    private static function short(string $body): string
    {
        $oneLine = trim((string) preg_replace('/\s+/u', ' ', $body));

        if (mb_strlen($oneLine) > 200) {
            $oneLine = mb_substr($oneLine, 0, 200).'…';
        }

        return $oneLine === '' ? '(пусто)' : $oneLine;
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
