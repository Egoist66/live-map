<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Переименовывает бренд в сохранённых FAQ, оферте и новостях.
 *
 * Код и SEO уже переведены на ULove, но managed-контент из админки
 * хранит старые тексты в reference_pages и app_updates. Без миграции
 * пользователи продолжают видеть Apricot в публичных страницах.
 */
return new class extends Migration
{
    /**
     * Заменяет Apricot на ULove в текстах и убирает UPin из карты.
     *
     * @return void
     */
    public function up(): void
    {
        $this->replaceBrand('reference_pages', ['title', 'body']);
        $this->replaceBrand('app_updates', ['title', 'body']);
        $this->renameLegacyMapPage();
    }

    /**
     * Бренд-миграция необратима: старое имя в контент не возвращаем.
     *
     * @return void
     */
    public function down(): void
    {
        // No-op: откат вернул бы Apricot в публичные тексты.
    }

    /**
     * Точечно обновляет строки, где в указанных полях остался старый бренд.
     *
     * @param string $table таблица managed-контента
     * @param array<int, string> $columns текстовые поля
     * @return void
     */
    private function replaceBrand(string $table, array $columns): void
    {
        $query = DB::table($table);

        $query->where(function ($builder) use ($columns) {
            foreach ($columns as $column) {
                $builder->orWhere($column, 'like', '%Apricot%');
            }
        });

        $updates = ['updated_at' => now()];

        foreach ($columns as $column) {
            $updates[$column] = DB::raw("REPLACE(`{$column}`, 'Apricot', 'ULove')");
        }

        $query->update($updates);
    }

    /**
     * Убирает бренд карты из legacy-страницы и оставляет нейтральный заголовок.
     *
     * @return void
     */
    private function renameLegacyMapPage(): void
    {
        $page = DB::table('reference_pages')->where('slug', 'faq-upin-about')->first();

        if ($page === null) {
            return;
        }

        $meta = json_decode((string) $page->meta, true);

        if (is_array($meta) && isset($meta['question'])) {
            $meta['question'] = 'Что за карта и как её включить?';
        }

        DB::table('reference_pages')
            ->where('id', $page->id)
            ->update([
                'title' => 'Карта',
                'body' => str_replace(['Apricot', 'UPin'], 'ULove', (string) $page->body),
                'meta' => is_array($meta)
                    ? json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    : $page->meta,
                'updated_at' => now(),
            ]);
    }
};
