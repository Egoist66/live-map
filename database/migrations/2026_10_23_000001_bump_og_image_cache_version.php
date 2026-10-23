<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Сбрасывает кэш OG-обложки после ребрендинга.
 *
 * Telegram и соцсети кэшируют картинку по точному URL: файл
 * `public/og-cover.jpg` уже перерисован под ULove, но старый Apricot
 * продолжал показываться, потому что адрес не менялся. Миграция
 * добавляет к сохранённому в админке `og_image` версионный query
 * `?v=3`, чтобы площадки перечитали изображение.
 */
return new class extends Migration
{
    /** @var string Новый адрес обложки с cache-busting версией. */
    private const NEW_IMAGE = '/og-cover.jpg?v=3';

    /** @var string Путь стандартной обложки без query-версии. */
    private const LEGACY_PATH = '/og-cover.jpg';

    /**
     * Обновить глобальную обложку и обложки отдельных страниц.
     *
     * @return void
     */
    public function up(): void
    {
        $this->bumpGlobalImage();
        $this->bumpPageImages();
    }

    /**
     * Бренд-миграция необратима: возвращать URL с закэшированной
     * Apricot-обложкой не нужно.
     *
     * @return void
     */
    public function down(): void
    {
        // No-op.
    }

    /**
     * Заменить устаревший адрес в глобальных SEO-настройках.
     *
     * @return void
     */
    private function bumpGlobalImage(): void
    {
        $row = DB::table('app_settings')->where('key', 'seo.global')->first();

        if ($row === null) {
            return;
        }

        $seo = json_decode((string) $row->value, true);

        if (! is_array($seo)) {
            return;
        }

        $current = $seo['og_image'] ?? null;

        if (! $this->isLegacyImage($current)) {
            return;
        }

        $seo['og_image'] = self::NEW_IMAGE;

        $this->saveJson('seo.global', $seo);
    }

    /**
     * Заменить устаревший адрес во всех переопределениях страниц.
     *
     * @return void
     */
    private function bumpPageImages(): void
    {
        $row = DB::table('app_settings')->where('key', 'seo.pages')->first();

        if ($row === null) {
            return;
        }

        $pages = json_decode((string) $row->value, true);

        if (! is_array($pages)) {
            return;
        }

        $hasChanges = false;

        foreach ($pages as $index => $page) {
            if (! is_array($page)) {
                continue;
            }

            $current = $page['og_image'] ?? null;

            if (! $this->isLegacyImage($current)) {
                continue;
            }

            $pages[$index]['og_image'] = self::NEW_IMAGE;
            $hasChanges = true;
        }

        if (! $hasChanges) {
            return;
        }

        $this->saveJson('seo.pages', $pages);
    }

    /**
     * Адрес указывает на стандартную обложку без новой версии.
     *
     * @param mixed $value сохранённое значение og_image
     * @return bool
     */
    private function isLegacyImage(mixed $value): bool
    {
        if (! is_string($value)) {
            return false;
        }

        $trimmed = trim($value);

        if ($trimmed === '') {
            return false;
        }

        $path = parse_url($trimmed, PHP_URL_PATH);

        if ($path !== self::LEGACY_PATH) {
            return false;
        }

        $query = parse_url($trimmed, PHP_URL_QUERY);

        return $query === null || $query === '' || $query === 'v=2';
    }

    /**
     * Сохранить JSON в app_settings и сбросить кэш сервиса SEO.
     *
     * @param string $key ключ вида seo.global
     * @param array<string, mixed> $value данные
     * @return void
     */
    private function saveJson(string $key, array $value): void
    {
        DB::table('app_settings')
            ->where('key', $key)
            ->update([
                'value' => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'updated_at' => now(),
            ]);

        Cache::forget('appsettings:' . $key);
    }
};
