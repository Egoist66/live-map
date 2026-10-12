<?php

namespace App\Ai\Tools;

use App\Models\ReferencePage;
use App\Models\User;
use Illuminate\Contracts\JsonSchema\JsonSchema;
use Illuminate\Support\Collection;
use Laravel\Ai\Contracts\Tool;
use Laravel\Ai\Tools\Request;
use Stringable;
use Throwable;

/**
 * Поиск по опубликованным справочным страницам для гида.
 *
 * Даёт агенту факты из базы знаний приложения (инструкции, правила,
 * описания функций), чтобы он не выдумывал кнопки и разделы.
 *
 * Доступность статей режется гейтом модулей: статья с meta.module
 * видна только пользователям с включённым модулем (User::hasModule
 * учитывает legacy-режим и глобальный выключатель админки).
 * Статьи без метки модуля — общие, видны всем.
 */
class SearchHelpArticles implements Tool
{
    /**
     * Сколько статей возвращать за один вызов.
     */
    public const MAX_RESULTS = 3;

    /**
     * Сколько символов тела статьи отдавать модели.
     */
    public const BODY_LIMIT = 800;

    /**
     * @param  User|null  $user  читатель статей (гейт модулей)
     */
    public function __construct(public ?User $user = null) {}

    /**
     * Описание назначения инструмента для модели.
     *
     * @return Stringable|string описание на русском языке
     */
    public function description(): Stringable|string
    {
        return 'Ищи ответ в справочных страницах приложения по ключевым словам. '
            .'Вызывай перед ответом, когда вопрос касается функций, правил, тарифов или настроек. '
            .'Инструмент сам скрывает статьи выключенных у пользователя модулей.';
    }

    /**
     * Найти опубликованные статьи по ключевым словам с учётом модулей.
     *
     * @param  Request  $request  аргументы вызова (query)
     * @return Stringable|string найденные статьи либо пометка об отсутствии
     */
    public function handle(Request $request): Stringable|string
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:200'],
        ]);

        $words = $this->keywords((string) $validated['query']);

        if ($words === []) {
            return 'Ничего не найдено.';
        }

        try {
            $pages = $this->findPages($words);
        } catch (Throwable) {
            return 'База знаний временно недоступна.';
        }

        $visible = $pages->filter(fn (ReferencePage $page): bool => $this->isVisible($page));
        $ranked = $this->rankPages($visible, $words);
        $shown = $ranked->take(self::MAX_RESULTS);

        if ($shown->isEmpty()) {
            return 'Ничего не найдено.';
        }

        $chunks = $shown->map(function (ReferencePage $page): string {
            $body = mb_substr(strip_tags((string) $page->body), 0, self::BODY_LIMIT);

            return "[{$page->slug}] {$page->title}\n{$body}";
        });

        return $chunks->implode("\n\n---\n\n");
    }

    /**
     * Схема аргументов инструмента.
     *
     * @param  JsonSchema  $schema  билдер JSON-схемы
     * @return array<string, mixed> поле поискового запроса
     */
    public function schema(JsonSchema $schema): array
    {
        return [
            'query' => $schema->string()->required(),
        ];
    }

    /**
     * Выбрать статьи-кандидаты по словам из запроса.
     *
     * Каждое слово ищем в трёх видах: как есть, с заменой «е» на «ё»
     * и наоборот (MySQL LIKE их не отождествляет), плюс скелет
     * с wildcard вместо гласных — он ловит чередования вроде
     * «матч»/«мэтч», которые заменой е/ё не покрываются.
     *
     * @param  string[]  $words  значимые слова
     * @return Collection<int, ReferencePage>
     */
    private function findPages(array $words): Collection
    {
        $variants = [];

        foreach ($words as $word) {
            $variants[] = $word;
            $variants[] = str_replace('е', 'ё', $word);
            $variants[] = str_replace('ё', 'е', $word);

            $skeleton = preg_replace('/[аеёиоуыэюя]/u', '_', $word);

            if (is_string($skeleton) && $skeleton !== $word) {
                $variants[] = $skeleton;
            }
        }

        $variants = array_values(array_unique($variants));

        return ReferencePage::query()
            ->published()
            ->where(function ($query) use ($variants): void {
                foreach ($variants as $variant) {
                    $query->orWhere('title', 'like', '%'.$variant.'%');
                    $query->orWhere('body', 'like', '%'.$variant.'%');
                }
            })
            ->orderBy('slug')
            ->limit(self::MAX_RESULTS * 3)
            ->get(['slug', 'title', 'body', 'meta']);
    }

    /**
     * Отранжировать кандидатов: совпадение в заголовке весит втрое больше.
     *
     * Гласные в словах заменяются wildcard-точкой, поэтому «матч»
     * находит «мэтч». Нулевой скор — мимо, такие отбрасываем.
     *
     * @param  Collection<int, ReferencePage>  $pages  кандидаты
     * @param  string[]  $words  значимые слова
     * @return Collection<int, ReferencePage>
     */
    private function rankPages(Collection $pages, array $words): Collection
    {
        $patterns = [];

        foreach ($words as $word) {
            $quoted = preg_quote(mb_strtolower($word), '/');
            $patterns[] = '/'.preg_replace('/[аеёиоуыэюя]/u', '.', $quoted).'/u';
        }

        $scored = $pages->map(function (ReferencePage $page) use ($patterns): array {
            $title = mb_strtolower(strip_tags((string) $page->title));
            $body = mb_strtolower(strip_tags((string) $page->body));
            $score = 0;

            foreach ($patterns as $pattern) {
                if (@preg_match($pattern, $title) === 1) {
                    $score += 3;
                }

                if (@preg_match($pattern, $body) === 1) {
                    $score += 1;
                }
            }

            return ['page' => $page, 'score' => $score];
        });

        return $scored
            ->filter(static fn (array $item): bool => $item['score'] > 0)
            ->sortByDesc('score')
            ->values()
            ->map(static fn (array $item): ReferencePage => $item['page']);
    }

    /**
     * Видна ли статья текущему пользователю по гейту модулей.
     *
     * Статья без meta.module — общая. Статья с неизвестной меткой —
     * скрыта (fail-closed: непонятное не показываем).
     *
     * @param  ReferencePage  $page  проверяемая статья
     */
    private function isVisible(ReferencePage $page): bool
    {
        $meta = $page->meta;
        $module = is_array($meta) ? ($meta['module'] ?? null) : null;

        if (! is_string($module) || $module === '') {
            return true;
        }

        if (! in_array($module, User::allModules(), true)) {
            return false;
        }

        if ($this->user === null) {
            return $module === 'ulove';
        }

        try {
            return $this->user->hasModule($module);
        } catch (Throwable) {
            return $module === 'ulove';
        }
    }

    /**
     * Разбить запрос на значимые слова для LIKE-поиска.
     *
     * @param  string  $query  сырой запрос модели
     * @return string[] слова от 3 символов
     */
    private function keywords(string $query): array
    {
        $normalized = mb_strtolower($query);
        $words = preg_split('/[^\p{L}\p{N}]+/u', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $meaningful = array_filter($words, static fn (string $word): bool => mb_strlen($word) >= 3);
        $unique = array_unique($meaningful);

        return array_values($unique);
    }
}
