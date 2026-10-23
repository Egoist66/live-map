<?php

namespace App\Http\Controllers;

use App\Services\BrandingService;
use App\Services\MediaDisk;
use App\Services\SeoSettingsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Публичные файлы брендинга: манифест PWA и стабильный URL иконки.
 *
 * Манифест собирается на лету, чтобы загруженная в админке иконка
 * сразу попадала в установку PWA, а не ждала пересборки фронта.
 */
class BrandingController extends Controller
{
    /**
     * Манифест PWA с актуальной иконкой, SEO-названием и цветом системного хрома.
     *
     * `theme_color` манифеста красит системную панель навигации Android
     * (жестовая полоса под нашим нижним меню), поэтому он обязан совпадать
     * с фоном нижней навигации: белый в светлой теме, #0F121F в тёмной
     * и чёрный в AMOLED. Тему передаёт blade-скрипт/`useTheme` query-парой
     * `theme` + cookie `ulove_theme` — за один запрос манифест статичен,
     * а значит не может сам подстроиться под тему.
     *
     * @param Request $request запрос с необязательным `theme` (light|dark|amoled)
     * @return JsonResponse
     */
    public function manifest(Request $request): JsonResponse
    {
        $seo = SeoSettingsService::global();
        $branding = BrandingService::state();
        $isCustom = $branding['app_icon']['is_custom'];
        $iconUrl = $branding['app_icon']['url'];
        $iconType = BrandingService::appIconMime();
        $themeColor = $this->resolveChromeColor($request);

        $icons = $isCustom
            ? [
                ['src' => $iconUrl, 'sizes' => '192x192', 'type' => $iconType, 'purpose' => 'any'],
                ['src' => $iconUrl, 'sizes' => '512x512', 'type' => $iconType, 'purpose' => 'any'],
            ]
            : [
                ['src' => '/pwa-192x192.png?v=2', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => '/pwa-512x512.png?v=2', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => '/maskable-512x512.png?v=2', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
                ['src' => '/pwa-icon.svg?v=2', 'sizes' => 'any', 'type' => 'image/svg+xml', 'purpose' => 'any'],
            ];

        $shortcutIcon = $isCustom
            ? ['src' => $iconUrl, 'sizes' => '192x192', 'type' => $iconType, 'purpose' => 'any']
            : ['src' => '/pwa-192x192.png?v=2', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'];

        $payload = [
            'name' => $seo['site_name'] ?: config('seo.site_name', 'ULove'),
            'short_name' => $seo['site_name'] ?: config('seo.site_name', 'ULove'),
            'description' => $seo['default_description'] ?: config('seo.default_description'),
            'start_url' => '/?source=pwa',
            'display' => 'standalone',
            'background_color' => '#FD267D',
            'theme_color' => $themeColor,
            'lang' => 'ru-RU',
            'scope' => '/',
            'id' => '/?source=pwa',
            'orientation' => 'any',
            'dir' => 'ltr',
            'categories' => ['social', 'navigation', 'lifestyle'],
            'icons' => $icons,
            'shortcuts' => [
                [
                    'name' => 'Свайпы',
                    'short_name' => 'Свайпы',
                    'description' => 'Знакомства рядом: свайпы, мэтчи и чаты',
                    'url' => '/swipes?source=pwa-shortcut',
                    'icons' => $isCustom
                        ? [$shortcutIcon]
                        : [
                            ['src' => '/ulove-swipes.svg', 'sizes' => 'any', 'type' => 'image/svg+xml'],
                            $shortcutIcon,
                        ],
                ],
                [
                    'name' => 'Чаты',
                    'short_name' => 'Чаты',
                    'description' => 'Переписки и сообщения',
                    'url' => '/chat?source=pwa-shortcut',
                    'icons' => [$shortcutIcon],
                ],
            ],
        ];

        return response()
            ->json($payload)
            ->header('Content-Type', 'application/manifest+json')
            ->header('Cache-Control', 'private, max-age=300')
            ->header('Vary', 'Cookie');
    }

    /**
     * Цвет системной панели навигации под нижним меню.
     *
     * Приоритет: query-параметр `theme` (его ставит blade-скрипт до первой
     * отрисовки), затем cookie `ulove_theme` (её обновляет `useTheme`),
     * затем светлая тема. Неизвестные значения игнорируются.
     *
     * @param Request $request запрос манифеста
     * @return string hex-цвет фона нижней навигации
     */
    private function resolveChromeColor(Request $request): string
    {
        $theme = $request->query('theme');

        if (! is_string($theme) || ! in_array($theme, ['light', 'dark', 'amoled'], true)) {
            $theme = $request->cookie('ulove_theme');
        }

        return match ($theme) {
            'dark' => '#0F121F',
            'amoled' => '#000000',
            default => '#FFFFFF',
        };
    }

    /**
     * Стабильный URL иконки приложения для пуш-уведомлений.
     *
     * Отдаёт файл из хранилища; если кастомной иконки нет —
     * редиректит на дефолтную статику.
     *
     * @return \Symfony\Component\HttpFoundation\Response|RedirectResponse
     */
    public function icon(): mixed
    {
        $path = BrandingService::appIconPath();

        if ($path !== null) {
            $disk = Storage::disk(MediaDisk::disk());

            if ($disk->exists($path)) {
                return $disk->response($path, null, [
                    'Cache-Control' => 'public, max-age=3600',
                ]);
            }
        }

        return redirect(BrandingService::DEFAULT_APP_ICON);
    }
}
