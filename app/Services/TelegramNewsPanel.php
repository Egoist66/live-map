<?php

namespace App\Services;

use App\Models\BotBroadcast;
use App\Models\User;

/**
 * Лента публикаций в боте: последние статьи и опросы.
 *
 * Кто пропустил рассылку или пришёл позже — видит всё здесь
 * командой /news. Статьи показываем целиком (тем же лонгридом,
 * что в рассылке), опросы — вопросом, вариантами и итогами:
 * переголосовать из ленты нельзя (нативный опрос живёт только
 * в сообщении рассылки), но итоги видны всем.
 */
class TelegramNewsPanel
{
    /**
     * Сколько публикаций показываем в ленте.
     */
    public const FEED_LIMIT = 5;

    /**
     * Собрать ленту для пользователя.
     *
     * @param User $user зритель
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function feed(User $user): array
    {
        try {
            $items = BotBroadcast::published()->limit(self::FEED_LIMIT)->get();
        } catch (\Throwable) {
            $items = collect();
        }

        if ($items->isEmpty()) {
            $text = "📰 <b>Новостей пока нет</b>.\nКак только команда ULove что-то опубликует — оно прилетит сюда же, прямо в бот. Заглядывайте!";

            return [
                'text' => $text,
                'keyboard' => TelegramMenu::withNav([
                    [TelegramMenu::openAppButton('🌐 Открыть приложение')],
                ]),
            ];
        }

        $blocks = [];

        foreach ($items as $item) {
            $blocks[] = self::itemText($item);
        }

        $text = "📰 <b>Последние новости ULove</b>\n\n".implode("\n\n────────────────\n\n", $blocks);

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav([
                [TelegramMenu::openAppButton('🌐 Открыть приложение')],
            ]),
        ];
    }

    /**
     * Текст одного пункта ленты.
     *
     * @param BotBroadcast $broadcast публикация
     * @return string
     */
    private static function itemText(BotBroadcast $broadcast): string
    {
        $date = $broadcast->published_at?->format('d.m.Y');

        if ($broadcast->isPoll()) {
            return self::pollText($broadcast, $date);
        }

        return self::articleText($broadcast, $date);
    }

    /**
     * Статья в ленте: заголовок + текст целиком.
     *
     * @param BotBroadcast $broadcast статья
     * @param string|null $date дата публикации
     * @return string
     */
    private static function articleText(BotBroadcast $broadcast, ?string $date): string
    {
        $lines = [];
        $lines[] = '📝 <b>'.self::esc((string) $broadcast->title).'</b>';

        if ($date !== null && $date !== '') {
            $lines[] = '<i>'.$date.'</i>';
        }

        $body = trim((string) ($broadcast->body ?? ''));
        $excerpt = mb_strlen($body) > 1500 ? mb_substr($body, 0, 1500).'…' : $body;

        if ($excerpt !== '') {
            $lines[] = '';
            $lines[] = self::esc($excerpt);
        }

        return implode("\n", $lines);
    }

    /**
     * Опрос в ленте: вопрос + варианты + итоги.
     *
     * @param BotBroadcast $broadcast опрос
     * @param string|null $date дата публикации
     * @return string
     */
    private static function pollText(BotBroadcast $broadcast, ?string $date): string
    {
        $lines = [];
        $lines[] = '📊 <b>'.self::esc((string) ($broadcast->poll_question ?? $broadcast->title)).'</b>';

        if ($date !== null && $date !== '') {
            $lines[] = '<i>'.$date.'</i>';
        }

        $index = 0;

        foreach ($broadcast->pollOptions() as $option) {
            $index++;
            $lines[] = $index.'. '.self::esc($option);
        }

        $votes = (int) $broadcast->votes_count;
        $lines[] = '';
        $lines[] = "🗳 Голосов: <b>{$votes}</b>";

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
