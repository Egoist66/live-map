<?php

namespace App\Http\Controllers;

use App\Services\SeoSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Админ-API раздела SEO (стиль WordPress / RankMath).
 *
 * Все методы за middleware ['web','auth','admin'] (см. routes/api.php).
 * GET отдаёт все секции одним запросом, PUT — сохраняет секцию за секцией,
 * чтобы фронт мог слать маленькие формы без перезаписи чужого.
 */
class AdminSeoController extends Controller
{
    /**
     * Отдать все SEO-секции одним запросом.
     *
     * @return JsonResponse global + integrations + pages + robots + sitemap
     */
    public function show(): JsonResponse
    {
        return response()->json(SeoSettingsService::all());
    }

    /**
     * Сохранить глобальные метатеги.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function updateGlobal(Request $request): JsonResponse
    {
        $data = $request->validate([
            'site_name' => 'nullable|string|max:120',
            'title_suffix' => 'nullable|string|max:60',
            'default_title' => 'nullable|string|max:200',
            'default_description' => 'nullable|string|max:500',
            'keywords' => 'nullable',
            'author' => 'nullable|string|max:120',
            'locale' => 'nullable|string|max:20',
            'og_type' => 'nullable|string|max:40',
            'twitter_card' => 'nullable|string|max:60',
            'twitter_site' => 'nullable|string|max:60',
            'theme_color' => 'nullable|string|max:20',
            'og_image' => 'nullable|string|max:500',
            'robots_default' => 'nullable|string|max:200',
        ]);

        if (array_key_exists('keywords', $data) && is_array($data['keywords'])) {
            $data['keywords'] = implode(', ', $data['keywords']);
        }

        return response()->json(SeoSettingsService::saveGlobal($data));
    }

    /**
     * Сохранить интеграции: верификации, счётчики, пиксели, скрипты.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function updateIntegrations(Request $request): JsonResponse
    {
        $data = $request->validate([
            'google_site_verification' => 'nullable|string|max:200',
            'yandex_verification' => 'nullable|string|max:200',
            'bing_verification' => 'nullable|string|max:200',
            'google_analytics_id' => 'nullable|string|max:40',
            'google_tag_manager_id' => 'nullable|string|max:40',
            'yandex_metrica_id' => 'nullable|string|max:20',
            'facebook_pixel_id' => 'nullable|string|max:40',
            'vk_pixel_id' => 'nullable|string|max:40',
            'scripts_enabled' => 'sometimes|boolean',
            'head_scripts' => 'nullable|string|max:20000',
            'body_start_scripts' => 'nullable|string|max:20000',
            'body_end_scripts' => 'nullable|string|max:20000',
        ]);

        return response()->json(SeoSettingsService::saveIntegrations($data));
    }

    /**
     * Сохранить переопределения мета для страниц.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function updatePages(Request $request): JsonResponse
    {
        $data = $request->validate([
            'pages' => 'present|array|max:100',
            'pages.*.path' => 'required|string|max:200',
            'pages.*.title' => 'nullable|string|max:200',
            'pages.*.description' => 'nullable|string|max:500',
            'pages.*.keywords' => 'nullable|string|max:500',
            'pages.*.og_title' => 'nullable|string|max:200',
            'pages.*.og_description' => 'nullable|string|max:500',
            'pages.*.og_image' => 'nullable|string|max:500',
            'pages.*.canonical' => 'nullable|string|max:500',
            'pages.*.robots' => 'nullable|string|max:120',
            'pages.*.enabled' => 'sometimes|boolean',
        ]);

        return response()->json(SeoSettingsService::savePages($data['pages'] ?? []));
    }

    /**
     * Сохранить настройки robots.txt.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function updateRobots(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mode' => 'required|in:auto,custom',
            'custom_text' => 'nullable|string|max:5000',
            'extra_disallow' => 'nullable',
            'extra_allow' => 'nullable',
            'crawl_delay' => 'nullable|integer|min:0|max:60',
            'sitemap_enabled' => 'sometimes|boolean',
        ]);

        return response()->json(SeoSettingsService::saveRobots($data));
    }

    /**
     * Сохранить настройки sitemap.xml.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function updateSitemap(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => 'sometimes|boolean',
            'extra_urls' => 'nullable',
            'excluded_paths' => 'nullable',
        ]);

        return response()->json(SeoSettingsService::saveSitemap($data));
    }
}
