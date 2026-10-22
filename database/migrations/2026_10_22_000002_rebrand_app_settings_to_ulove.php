<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Переводит сохранённые настройки приложения с Apricot на ULove.
 *
 * Миграция нужна для баз, где SEO и текст техработ уже записаны
 * через админку: конфиг и код переименованы, но JSON в app_settings
 * остался старым и перекрывал новые значения на проде.
 */
return new class extends Migration
{
    /**
     * Обновляет SEO-название, описание, ключевые слова и текст техработ.
     *
     * @return void
     */
    public function up(): void
    {
        $this->updateMaintenanceMessage();
        $this->updateGlobalSeo();
    }

    /**
     * Бренд-миграция необратима: возвращать старое имя в прод не нужно.
     *
     * @return void
     */
    public function down(): void
    {
        // No-op: откат вернул бы Apricot в пользовательские тексты.
    }

    /**
     * Заменяет старое имя в сообщении режима техработ.
     *
     * @return void
     */
    private function updateMaintenanceMessage(): void
    {
        $row = DB::table('app_settings')->where('key', 'maintenance.message')->first();

        if ($row === null) {
            return;
        }

        $message = (string) $row->value;

        if (! str_contains($message, 'Apricot') && ! str_contains($message, 'UPin')) {
            return;
        }

        $updated = str_replace(['Apricot', 'UPin'], 'ULove', $message);

        DB::table('app_settings')
            ->where('key', 'maintenance.message')
            ->update(['value' => $updated, 'updated_at' => now()]);
    }

    /**
     * Переписывает глобальные SEO-поля, сохраняя остальные настройки.
     *
     * @return void
     */
    private function updateGlobalSeo(): void
    {
        $row = DB::table('app_settings')->where('key', 'seo.global')->first();

        if ($row === null) {
            return;
        }

        $seo = json_decode((string) $row->value, true);

        if (! is_array($seo)) {
            return;
        }

        $seo['site_name'] = 'ULove';
        $seo['title_suffix'] = ' — ULove';
        $seo['default_title'] = 'ULove — знакомства рядом';
        $seo['default_description'] = 'ULove — знакомства рядом: свайпы, мэтч открывает чат. '
            .'Листай людей рядом, лайкай в один тап, переписывайся только по взаимности. Строго 18+.';
        $seo['author'] = 'ULove';
        $seo['keywords'] = $this->replaceBrandKeywords($seo['keywords'] ?? []);

        DB::table('app_settings')
            ->where('key', 'seo.global')
            ->update([
                'value' => json_encode($seo, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'updated_at' => now(),
            ]);
    }

    /**
     * Убирает старое имя из списка ключевых слов.
     *
     * @param mixed $keywords сохранённый список
     * @return array<int, string>
     */
    private function replaceBrandKeywords(mixed $keywords): array
    {
        if (! is_array($keywords)) {
            return ['ULove', 'знакомства рядом', 'свайпы', 'мэтч', 'дейтинг'];
        }

        $brands = ['Apricot', 'UPin', 'upin'];
        $clean = [];

        foreach ($keywords as $keyword) {
            if (! is_string($keyword) || $keyword === '') {
                continue;
            }

            $clean[] = in_array($keyword, $brands, true) ? 'ULove' : $keyword;
        }

        return array_values(array_unique($clean));
    }
};
