<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Центральное хранилище SEO-настроек приложения (стиль WordPress / RankMath).
 *
 * Зачем нужен:
 * - Все SEO-аспекты (глобальные мета, мета отдельных страниц, счётчики
 *   Google/Yandex, произвольные скрипты в head/body, robots.txt и sitemap.xml)
 *   редактируются из админ-панели без правки кода и деплоя.
 * - Значения по умолчанию берутся из config/seo.php («то что уже имеем —
 *   не удаляем»): пока админ ничего не сохранил, отдаются именно они.
 * - Хранение — поверх key-value таблицы app_settings (AppSettings),
 *   JSON-значения лежат под ключами seo.global, seo.integrations и т.д.
 *
 * Ключи хранения:
 * - seo.global — глобальные метатеги по умолчанию;
 * - seo.pages — список переопределений мета для отдельных путей;
 * - seo.integrations — верификации, GTM/Analytics/Метрика, пиксели, скрипты;
 * - seo.robots — режим robots.txt;
 * - seo.sitemap — состав sitemap.xml.
 */
class SeoSettingsService
{
    /** @var string[] Пути страниц, известных приложению (для подсказок в админке). */
    public const KNOWN_PATHS = [
        '/',
        '/map',
        '/flow',
        '/swipes',
        '/faq',
        '/contacts',
        '/privacy',
        '/offer',
        '/login',
        '/register',
    ];

    /**
     * Глобальные SEO-настройки с дефолтами из config/seo.php.
     *
     * @return array<string, mixed>
     */
    public static function global(): array
    {
        $stored = self::getJson('seo.global', []);

        $defaults = [
            'site_name' => config('seo.site_name'),
            'title_suffix' => config('seo.title_suffix'),
            'default_title' => config('seo.default_title'),
            'default_description' => config('seo.default_description'),
            'keywords' => config('seo.keywords', []),
            'author' => config('seo.author'),
            'locale' => config('seo.locale', 'ru_RU'),
            'og_type' => config('seo.og_type', 'website'),
            'twitter_card' => config('seo.twitter_card', 'summary_large_image'),
            'twitter_site' => config('seo.twitter_site'),
            'theme_color' => config('seo.theme_color', '#0F172A'),
            'og_image' => config('seo.image', '/og-cover.jpg'),
            'robots_default' => config('seo.robots'),
        ];

        return array_merge($defaults, $stored);
    }

    /**
     * Сохранить глобальные настройки.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public static function saveGlobal(array $data): array
    {
        $clean = self::filterKeys($data, [
            'site_name', 'title_suffix', 'default_title', 'default_description',
            'keywords', 'author', 'locale', 'og_type', 'twitter_card',
            'twitter_site', 'theme_color', 'og_image', 'robots_default',
        ]);

        if (isset($clean['keywords']) && is_string($clean['keywords'])) {
            $parts = explode(',', $clean['keywords']);
            $trimmed = array_map(static fn ($p) => trim((string) $p), $parts);
            $filtered = array_filter($trimmed);
            $clean['keywords'] = array_values($filtered);
        }

        self::setJson('seo.global', $clean, true);

        return self::global();
    }

    /**
     * Интеграции и скрипты (Google/Yandex/пиксели/произвольный код).
     *
     * @return array<string, mixed>
     */
    public static function integrations(): array
    {
        $stored = self::getJson('seo.integrations', []);

        $defaults = [
            'google_site_verification' => null,
            'yandex_verification' => null,
            'bing_verification' => null,
            'google_analytics_id' => null,
            'google_tag_manager_id' => null,
            'yandex_metrica_id' => null,
            'facebook_pixel_id' => null,
            'vk_pixel_id' => null,
            'scripts_enabled' => true,
            'head_scripts' => null,
            'body_start_scripts' => null,
            'body_end_scripts' => null,
        ];

        return array_merge($defaults, $stored);
    }

    /**
     * Сохранить интеграции.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public static function saveIntegrations(array $data): array
    {
        $clean = self::filterKeys($data, [
            'google_site_verification', 'yandex_verification', 'bing_verification',
            'google_analytics_id', 'google_tag_manager_id', 'yandex_metrica_id',
            'facebook_pixel_id', 'vk_pixel_id', 'scripts_enabled',
            'head_scripts', 'body_start_scripts', 'body_end_scripts',
        ]);

        $clean['scripts_enabled'] = (bool) ($clean['scripts_enabled'] ?? true);

        self::setJson('seo.integrations', $clean, true);

        return self::integrations();
    }

    /**
     * Переопределения мета для отдельных страниц/путей.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function pages(): array
    {
        $stored = self::getJson('seo.pages', []);

        if (! is_array($stored)) {
            return [];
        }

        return array_values($stored);
    }

    /**
     * Сохранить список страниц.
     *
     * @param array<int, array<string, mixed>> $pages
     * @return array<int, array<string, mixed>>
     */
    public static function savePages(array $pages): array
    {
        $clean = [];

        foreach ($pages as $row) {
            if (! is_array($row)) {
                continue;
            }

            $path = '/' . ltrim(trim((string) ($row['path'] ?? '')), '/');

            if ($path === '' || $path === '/.') {
                continue;
            }

            $entry = [
                'path' => $path,
                'title' => self::strOrNull($row['title'] ?? null, 200),
                'description' => self::strOrNull($row['description'] ?? null, 500),
                'keywords' => self::strOrNull($row['keywords'] ?? null, 500),
                'og_title' => self::strOrNull($row['og_title'] ?? null, 200),
                'og_description' => self::strOrNull($row['og_description'] ?? null, 500),
                'og_image' => self::strOrNull($row['og_image'] ?? null, 500),
                'canonical' => self::strOrNull($row['canonical'] ?? null, 500),
                'robots' => self::strOrNull($row['robots'] ?? null, 120),
                'enabled' => (bool) ($row['enabled'] ?? true),
            ];

            if ($entry['title'] === null && $entry['description'] === null) {
                continue;
            }

            $clean[] = $entry;
        }

        self::setJson('seo.pages', $clean);

        return self::pages();
    }

    /**
     * Найти переопределение для текущего пути (точное совпадение).
     *
     * @param string $path путь вида /map
     * @return array<string, mixed>|null
     */
    public static function pageFor(string $path): ?array
    {
        $needle = '/' . ltrim(trim($path), '/');

        foreach (self::pages() as $page) {
            if (! ($page['enabled'] ?? true)) {
                continue;
            }

            if (($page['path'] ?? null) === $needle) {
                return $page;
            }
        }

        return null;
    }

    /**
     * Настройки robots.txt.
     *
     * @return array<string, mixed>
     */
    public static function robots(): array
    {
        $stored = self::getJson('seo.robots', []);

        return array_merge([
            'mode' => 'auto',
            'custom_text' => null,
            'extra_disallow' => [],
            'extra_allow' => [],
            'crawl_delay' => 1,
            'sitemap_enabled' => true,
        ], $stored);
    }

    /**
     * Сохранить настройки robots.txt.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public static function saveRobots(array $data): array
    {
        $clean = self::filterKeys($data, [
            'mode', 'custom_text', 'extra_disallow', 'extra_allow',
            'crawl_delay', 'sitemap_enabled',
        ]);

        if (($clean['mode'] ?? 'auto') !== 'custom') {
            $clean['mode'] = 'auto';
        }

        $clean['extra_disallow'] = self::linesToArray($clean['extra_disallow'] ?? []);
        $clean['extra_allow'] = self::linesToArray($clean['extra_allow'] ?? []);
        $clean['crawl_delay'] = max(0, (int) ($clean['crawl_delay'] ?? 1));
        $clean['sitemap_enabled'] = (bool) ($clean['sitemap_enabled'] ?? true);

        self::setJson('seo.robots', $clean, true);

        return self::robots();
    }

    /**
     * Настройки sitemap.xml.
     *
     * @return array<string, mixed>
     */
    public static function sitemap(): array
    {
        $stored = self::getJson('seo.sitemap', []);

        return array_merge([
            'enabled' => true,
            'extra_urls' => [],
            'excluded_paths' => [],
        ], $stored);
    }

    /**
     * Сохранить настройки sitemap.xml.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public static function saveSitemap(array $data): array
    {
        $clean = self::filterKeys($data, [
            'enabled', 'extra_urls', 'excluded_paths',
        ]);

        $clean['enabled'] = (bool) ($clean['enabled'] ?? true);
        $clean['extra_urls'] = self::linesToArray($clean['extra_urls'] ?? []);
        $clean['excluded_paths'] = self::linesToArray($clean['excluded_paths'] ?? []);

        self::setJson('seo.sitemap', $clean, true);

        return self::sitemap();
    }

    /**
     * Всё сразу для админ-панели (один запрос вместо пяти).
     *
     * @return array<string, mixed>
     */
    public static function all(): array
    {
        return [
            'global' => self::global(),
            'integrations' => self::integrations(),
            'pages' => self::pages(),
            'robots' => self::robots(),
            'sitemap' => self::sitemap(),
            'known_paths' => self::KNOWN_PATHS,
            'defaults' => [
                'title' => config('seo.default_title'),
                'description' => config('seo.default_description'),
            ],
        ];
    }

    /**
     * Готовый набор мета для <head> текущего URL (для blade).
     *
     * @param string $currentUrl полный текущий URL
     * @param string $path текущий путь
     * @return array<string, mixed>
     */
    public static function forHead(string $currentUrl, string $path): array
    {
        $global = self::global();
        $page = self::pageFor($path);

        $title = $page['title'] ?? $global['default_title'];
        $description = $page['description'] ?? $global['default_description'];

        $keywordsRaw = $page['keywords'] ?? null;
        if ($keywordsRaw !== null) {
            $keywords = $keywordsRaw;
        } else {
            $keywordsList = $global['keywords'] ?? [];
            $keywords = is_array($keywordsList) ? implode(', ', $keywordsList) : (string) $keywordsList;
        }

        $robots = $page['robots'] ?? $global['robots_default'] ?? config('seo.robots');

        return [
            'site_name' => $global['site_name'],
            'title' => $title,
            'description' => $description,
            'keywords' => $keywords,
            'author' => $global['author'],
            'locale' => $global['locale'],
            'og_type' => $global['og_type'],
            'twitter_card' => $global['twitter_card'],
            'twitter_site' => $global['twitter_site'],
            'theme_color' => $global['theme_color'],
            'og_image' => $page['og_image'] ?? $global['og_image'],
            'og_title' => $page['og_title'] ?? $title,
            'og_description' => $page['og_description'] ?? $description,
            'canonical' => $page['canonical'] ?? $currentUrl,
            'robots' => $robots,
        ];
    }

    /**
     * Готовый набор для Inertia shared props (SPA-навигация).
     *
     * Помимо переопределения текущей страницы (`page`) отдаём и глобальные
     * настройки (`global`), чтобы фронт (`useSeo`) мог подхватить заданные
     * в админке title/description/keywords/robots по умолчанию, а не только
     * захардкоженные в страницах значения. Без этого правки раздела
     * «SEO → Общее» никак не отражались на сайте: Inertia `<Head>`
     * перезаписывает серверный `<title>` сразу после гидратации.
     *
     * @param string $path текущий путь
     * @return array<string, mixed>
     */
    public static function forInertia(string $path): array
    {
        $global = self::global();
        $page = self::pageFor($path);

        $globalKeywords = $global['keywords'] ?? [];
        $globalKeywords = is_array($globalKeywords) ? array_values($globalKeywords) : [];

        return [
            'title' => $page['title'] ?? $global['default_title'],
            'description' => $page['description'] ?? $global['default_description'],
            'page' => $page,
            'global' => [
                'site_name' => $global['site_name'] ?? null,
                'title' => $global['default_title'] ?? null,
                'description' => $global['default_description'] ?? null,
                'keywords' => $globalKeywords,
                'robots' => $global['robots_default'] ?? null,
                'og_image' => $global['og_image'] ?? null,
            ],
        ];
    }

    /**
     * Построить текст robots.txt с учётом настроек админки.
     *
     * @param string $baseUrl базовый URL приложения без слэша на конце
     * @param bool $isProd production-окружение или нет
     * @return string
     */
    public static function buildRobots(string $baseUrl, bool $isProd): string
    {
        $settings = self::robots();

        if ($settings['mode'] === 'custom' && is_string($settings['custom_text'])) {
            $custom = trim($settings['custom_text']);

            if ($custom !== '') {
                return $custom . "\n";
            }
        }

        if (! $isProd) {
            return "User-agent: *\nDisallow: /\n";
        }

        $lines = ['User-agent: *', 'Allow: /'];

        $baseDisallow = [
            '/admin', '/dashboard', '/profile', '/chat', '/settings',
            '/api/', '/*?*', '/login', '/register',
        ];

        foreach ($baseDisallow as $rule) {
            $lines[] = "Disallow: {$rule}";
        }

        foreach ((array) ($settings['extra_disallow'] ?? []) as $rule) {
            $lines[] = 'Disallow: ' . $rule;
        }

        foreach ((array) ($settings['extra_allow'] ?? []) as $rule) {
            $lines[] = 'Allow: ' . $rule;
        }

        $crawlDelay = (int) ($settings['crawl_delay'] ?? 1);

        if ($crawlDelay > 0) {
            $lines[] = "Crawl-delay: {$crawlDelay}";
        }

        $lines[] = '';

        if (($settings['sitemap_enabled'] ?? true) && self::sitemap()['enabled']) {
            $lines[] = "Sitemap: {$baseUrl}/sitemap.xml";
        }

        return implode("\n", $lines) . "\n";
    }

    /**
     * Построить список URL для sitemap.xml с учётом настроек админки.
     *
     * @param string $baseUrl базовый URL приложения без слэша на конце
     * @return array<int, array<string, string>>
     */
    public static function buildSitemapUrls(string $baseUrl): array
    {
        $settings = self::sitemap();
        $excluded = (array) ($settings['excluded_paths'] ?? []);

        $base = [
            ['loc' => $baseUrl . '/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['loc' => $baseUrl . '/faq', 'priority' => '0.8', 'changefreq' => 'weekly'],
            ['loc' => $baseUrl . '/contacts', 'priority' => '0.5', 'changefreq' => 'monthly'],
            ['loc' => $baseUrl . '/privacy', 'priority' => '0.4', 'changefreq' => 'monthly'],
            ['loc' => $baseUrl . '/offer', 'priority' => '0.4', 'changefreq' => 'monthly'],
            ['loc' => $baseUrl . '/map', 'priority' => '0.9', 'changefreq' => 'hourly'],
            ['loc' => $baseUrl . '/login', 'priority' => '0.3', 'changefreq' => 'monthly'],
            ['loc' => $baseUrl . '/register', 'priority' => '0.5', 'changefreq' => 'monthly'],
        ];

        $filtered = array_filter($base, static function (array $row) use ($baseUrl, $excluded): bool {
            $path = str_replace($baseUrl, '', $row['loc']);

            return ! in_array($path === '' ? '/' : $path, $excluded, true);
        });

        foreach ((array) ($settings['extra_urls'] ?? []) as $extra) {
            $extra = trim((string) $extra);

            if ($extra === '') {
                continue;
            }

            $loc = str_starts_with($extra, 'http') ? $extra : $baseUrl . '/' . ltrim($extra, '/');

            $filtered[] = ['loc' => $loc, 'priority' => '0.5', 'changefreq' => 'weekly'];
        }

        return array_values($filtered);
    }

    /**
     * Прочитать JSON-значение из AppSettings с кэшем.
     *
     * @param string $key ключ вида seo.global
     * @param mixed $default значение если пусто
     * @return mixed
     */
    private static function getJson(string $key, mixed $default = null): mixed
    {
        try {
            $raw = Cache::rememberForever(
                'appsettings:' . $key,
                static fn () => \App\Models\AppSetting::whereKey($key)->value('value')
            );
        } catch (\Throwable) {
            return $default;
        }

        if ($raw === null || $raw === '') {
            return $default;
        }

        $decoded = json_decode((string) $raw, true);

        return is_array($decoded) ? array_merge(is_array($default) ? $default : [], $decoded) : $default;
    }

    /**
     * Сохранить JSON-значение и сбросить кэш.
     *
     * @param string $key ключ вида seo.global
     * @param array<string, mixed>|array<int, mixed> $value данные
     * @param bool $merge смержить с текущим вместо перезаписи
     * @return void
     */
    private static function setJson(string $key, array $value, bool $merge = false): void
    {
        if ($merge) {
            $current = self::getJson($key, []);
            $current = is_array($current) ? $current : [];
            $value = array_merge($current, $value);
        }

        \App\Models\AppSetting::updateOrCreate(
            ['key' => $key],
            ['value' => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)]
        );

        Cache::forget('appsettings:' . $key);
    }

    /**
     * Оставить только разрешённые ключи.
     *
     * @param array<string, mixed> $data входные данные
     * @param string[] $allowed разрешённые ключи
     * @return array<string, mixed>
     */
    private static function filterKeys(array $data, array $allowed): array
    {
        $clean = [];

        foreach ($allowed as $key) {
            if (array_key_exists($key, $data)) {
                $clean[$key] = $data[$key];
            }
        }

        return $clean;
    }

    /**
     * Строка или null с обрезкой.
     *
     * @param mixed $value входное значение
     * @param int $max максимум символов
     * @return string|null
     */
    private static function strOrNull(mixed $value, int $max): ?string
    {
        if ($value === null) {
            return null;
        }

        $text = trim((string) $value);

        if ($text === '') {
            return null;
        }

        return mb_substr($text, 0, $max);
    }

    /**
     * Строки/массив строк в плоский массив (по строкам или запятым).
     *
     * @param mixed $value строка с переносами, массив или запятые
     * @return string[]
     */
    private static function linesToArray(mixed $value): array
    {
        if (is_array($value)) {
            $lines = $value;
        } else {
            $lines = preg_split('/[\r\n,]+/', (string) $value) ?: [];
        }

        $clean = [];

        foreach ($lines as $line) {
            $line = trim((string) $line);

            if ($line !== '') {
                $clean[] = $line;
            }
        }

        return array_values(array_unique($clean));
    }
}
