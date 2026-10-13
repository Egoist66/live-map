<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Мастер публикации админа: статья/опрос всем пользователям бота.
 *
 * Админ идёт командой /publish: выбирает тип, присылает содержимое
 * следующими сообщениями, смотрит превью и подтверждает — дальше
 * рассылка уже идёт фоном каждому в его чат с ботом. Черновик живёт
 * в кэше 30 минут (шаги title/body/photo/question/options/multiple),
 * колбэки короче 64 байт: pub_type:*, pub_skip_photo, pub_multi:*,
 * pub_send, pub_cancel.
 */
class TelegramPublishPanel
{
    /**
     * Сколько живёт черновик публикации, секунд.
     */
    public const DRAFT_TTL_SECONDS = 1800;

    /**
     * Лимит текста статьи (как у новостей AppUpdate).
     */
    public const BODY_LIMIT = 10000;

    /**
     * Ключ черновика в кэше.
     *
     * @param int $telegramId telegram_id админа
     * @return string
     */
    public static function draftKey(int $telegramId): string
    {
        return 'tg:publish:draft:'.$telegramId;
    }

    /**
     * Админ ли это (публиковать может только команда).
     *
     * @param User $user проверяемый
     * @return bool
     */
    public static function isAdmin(User $user): bool
    {
        return $user->isAdmin();
    }

    /**
     * Забрать черновик админа.
     *
     * @param int $telegramId telegram_id админа
     * @return array<string, mixed>|null null когда черновика нет
     */
    public static function getDraft(int $telegramId): ?array
    {
        if ($telegramId <= 0) {
            return null;
        }

        try {
            $draft = Cache::get(self::draftKey($telegramId));
        } catch (\Throwable) {
            return null;
        }

        return is_array($draft) ? $draft : null;
    }

    /**
     * Сохранить черновик (продлевает жизнь на 30 минут).
     *
     * @param int $telegramId telegram_id админа
     * @param array<string, mixed> $draft черновик
     * @return void
     */
    public static function saveDraft(int $telegramId, array $draft): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::put(self::draftKey($telegramId), $draft, self::DRAFT_TTL_SECONDS);
        } catch (\Throwable) {
        }
    }

    /**
     * Убрать черновик (отмена или успешный запуск рассылки).
     *
     * @param int $telegramId telegram_id админа
     * @return void
     */
    public static function clearDraft(int $telegramId): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::forget(self::draftKey($telegramId));
        } catch (\Throwable) {
        }
    }

    /**
     * Стартовый экран /publish: выбор типа публикации.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function start(): array
    {
        $text = "📣 <b>Новая публикация</b>\nНапишите один раз — бот положит копию каждому пользователю в его чат с ботом.\n\nЧто публикуем?";

        $keyboard = [
            [
                ['text' => '📝 Статья', 'callback_data' => 'pub_type:article'],
                ['text' => '📊 Опрос', 'callback_data' => 'pub_type:poll'],
            ],
            [
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Отказ не-админу: команда только для команды проекта.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function forbidden(): array
    {
        $text = '📣 Публикации — только для команды ULove. А все новости и опросы вы увидите здесь же, как только они выйдут!';

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav([
                [
                    ['text' => '📰 Последние новости', 'callback_data' => 'go_news'],
                ],
            ]),
        ];
    }

    /**
     * Просьба прислать заголовок статьи.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function askTitle(): array
    {
        $text = "📝 <b>Статья, шаг 1 из 3</b>\nПришлите заголовок следующим сообщением (до 200 символов).";

        $keyboard = [
            [
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Просьба прислать текст статьи.
     *
     * @param string $title принятый заголовок
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function askBody(string $title): array
    {
        $text = '📝 <b>Статья, шаг 2 из 3</b>'."\nЗаголовок: <b>".self::esc($title)."</b>\n\nТеперь пришлите текст статьи (до 10 000 символов, абзацы сохранятся).";

        $keyboard = [
            [
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Просьба прислать обложку или пропустить.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function askPhoto(): array
    {
        $text = "📝 <b>Статья, шаг 3 из 3</b>\nТекст принят! Пришлите фото-обложку следующим сообщением — или пропустите, выйдет текстовая статья.";

        $keyboard = [
            [
                ['text' => '⏭ Пропустить', 'callback_data' => 'pub_skip_photo'],
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Просьба прислать вопрос опроса.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function askQuestion(): array
    {
        $text = "📊 <b>Опрос, шаг 1 из 3</b>\nПришлите вопрос следующим сообщением (до 300 символов).";

        $keyboard = [
            [
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Просьба прислать варианты опроса.
     *
     * @param string $question принятый вопрос
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function askOptions(string $question): array
    {
        $text = '📊 <b>Опрос, шаг 2 из 3</b>'."\nВопрос: <b>".self::esc($question)."</b>\n\nПришлите варианты одним сообщением — по одному на строку (от 2 до 10, каждый до 100 символов).";

        $keyboard = [
            [
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Выбор: один вариант или несколько.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function askMultiple(): array
    {
        $text = "📊 <b>Опрос, шаг 3 из 3</b>\nВарианты приняты! Разрешить выбирать несколько сразу?";

        $keyboard = [
            [
                ['text' => '☝️ Один вариант', 'callback_data' => 'pub_multi:0'],
                ['text' => '✌️ Несколько', 'callback_data' => 'pub_multi:1'],
            ],
            [
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Превью перед рассылкой с кнопкой запуска.
     *
     * @param array<string, mixed> $draft черновик
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function preview(array $draft): array
    {
        $type = (string) ($draft['type'] ?? '');

        if ($type === 'poll') {
            $text = self::pollPreviewText($draft);
        } else {
            $text = self::articlePreviewText($draft);
        }

        $keyboard = [
            [
                ['text' => '✅ Разослать всем', 'callback_data' => 'pub_send'],
                ['text' => '❌ Отмена', 'callback_data' => 'pub_cancel'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Разобрать присланные варианты опроса в чистый список.
     *
     * @param string $raw сырой текст (по варианту на строку)
     * @return array<int, string> чистые варианты
     */
    public static function parseOptions(string $raw): array
    {
        $lines = preg_split("/\r\n?|\n/", $raw);

        if (! is_array($lines)) {
            return [];
        }

        $options = [];

        foreach ($lines as $line) {
            $clean = trim(mb_substr(trim((string) $line), 0, 100));

            if ($clean === '') {
                continue;
            }

            $options[] = $clean;
        }

        return array_values($options);
    }

    /**
     * Текст превью статьи.
     *
     * @param array<string, mixed> $draft черновик
     * @return string
     */
    private static function articlePreviewText(array $draft): string
    {
        $title = trim((string) ($draft['title'] ?? ''));
        $body = trim((string) ($draft['body'] ?? ''));
        $hasPhoto = ! empty($draft['photo_file_id']);

        $excerpt = mb_strlen($body) > 500 ? mb_substr($body, 0, 500).'…' : $body;

        $lines = [];
        $lines[] = '👀 <b>Превью статьи</b>';
        $lines[] = '';
        $lines[] = '<b>'.self::esc($title).'</b>';
        $lines[] = '';
        $lines[] = self::esc($excerpt);
        $lines[] = '';
        $lines[] = $hasPhoto ? '🖼 Обложка: прикреплена' : '🖼 Обложка: нет (текстовая статья)';
        $lines[] = '';
        $lines[] = 'Всё верно? Жмите «Разослать всем» — бот положит статью каждому в его чат с ботом.';

        return implode("\n", $lines);
    }

    /**
     * Текст превью опроса.
     *
     * @param array<string, mixed> $draft черновик
     * @return string
     */
    private static function pollPreviewText(array $draft): string
    {
        $question = trim((string) ($draft['question'] ?? ''));
        $options = is_array($draft['options'] ?? null) ? $draft['options'] : [];
        $multiple = (bool) ($draft['multiple'] ?? false);

        $lines = [];
        $lines[] = '👀 <b>Превью опроса</b>';
        $lines[] = '';
        $lines[] = '<b>'.self::esc($question).'</b>';

        $index = 0;

        foreach ($options as $option) {
            $index++;
            $lines[] = $index.'. '.self::esc((string) $option);
        }

        $lines[] = '';
        $lines[] = $multiple ? '✌️ Можно выбирать несколько вариантов' : '☝️ Один вариант на человека';
        $lines[] = '';
        $lines[] = 'Запускаем? Опрос прилетит каждому как нативный — голосуется прямо в чате, голоса посчитаем.';

        return implode("\n", $lines);
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
