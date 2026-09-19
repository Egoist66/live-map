<?php

namespace App\Services;

use App\Models\FlowPost;
use App\Models\Tag;

/**
 * Хэштеги постов UFlow: извлечение из текста и синхронизация пивота.
 *
 * Тег — #слово из букв/цифр/подчёркивания (кириллица тоже), имя хранится
 * в нижнем регистре. Счётчик tags.posts_count держится пересчётом
 * затронутых тегов, чтобы не плыть на даблкликах.
 */
class FlowHashtags
{
    /** Максимум тегов на пост. */
    public const MAX_PER_POST = 10;

    /**
     * Извлечь имена тегов из заголовка и текста.
     *
     * @param string|null $title заголовок
     * @param string|null $body текст
     * @return array<string>
     */
    public static function extract(?string $title, ?string $body): array
    {
        $text = trim((string) ($title.' '.(string) $body));

        if ($text === '') {
            return [];
        }

        preg_match_all('/#([\p{L}\p{N}_]{2,50})/u', $text, $matches);

        $names = [];

        foreach ($matches[1] ?? [] as $raw) {
            $name = mb_strtolower(trim((string) $raw));

            if ($name !== '' && ! in_array($name, $names, true)) {
                $names[] = $name;
            }

            if (count($names) >= self::MAX_PER_POST) {
                break;
            }
        }

        return $names;
    }

    /**
     * Пересинхронизировать теги поста и пересчитать счётчики.
     *
     * @param FlowPost $post пост
     */
    public static function sync(FlowPost $post): void
    {
        $names = self::extract($post->title, $post->body);

        $oldIds = $post->tags()->pluck('tags.id')->map(fn ($id) => (int) $id)->all();

        $tagIds = [];

        foreach ($names as $name) {
            $tag = Tag::firstOrCreate(['name' => $name]);
            $tagIds[] = (int) $tag->id;
        }

        $post->tags()->sync($tagIds);

        $touched = array_values(array_unique(array_merge($oldIds, $tagIds)));

        foreach ($touched as $tagId) {
            $tag = Tag::find($tagId);

            if (! $tag) {
                continue;
            }

            $tag->forceFill(['posts_count' => $tag->flowPosts()->count()])->save();

            if ((int) $tag->posts_count === 0) {
                $tag->delete();
            }
        }
    }
}
