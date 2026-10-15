<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Vite;
use Symfony\Component\HttpFoundation\Response;

/**
 * HTTP-заголовки безопасности для всех ответов.
 *
 * - Content-Security-Policy с per-request nonce: инлайн-скрипты и стили
 *   в app.blade.php подписаны тем же nonce через view()->share('cspNonce').
 *   Политика включается только когда разрешено конфигом security.csp_enabled
 *   (по умолчанию — лишь в production), чтобы не ломать Vite HMR в деве.
 * - Для страницы оплаты Cashier/Stripe действует ослабленная политика:
 *   разрешены cdn.jsdelivr.net, js.stripe.com и фреймы Stripe.
 * - Strict-Transport-Security — только поверх HTTPS.
 *
 * Базовые заголовки без контекста запроса (nosniff, frame-options,
 * referrer-policy, permissions-policy, COOP) ставит nginx — здесь их
 * не дублируем: задвоенный X-Frame-Options трактуется как DENY.
 * COEP/CORP сознательно не ставим: сломают подгрузку тайлов карты
 * и аватаров с чужих хостов без CORP-заголовков.
 */
class SecurityHeaders
{
    /**
     * Добавить заголовки безопасности к ответу.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response ответ с заголовками
     */
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = base64_encode(random_bytes(16));
        view()->share('cspNonce', $nonce);
        // Подписываем тем же nonce инлайн-скрипт префетча чанков,
        // который генерирует сам Vite (@vite) — иначе его режет script-src.
        Vite::useCspNonce($nonce);

        /** @var Response $response */
        $response = $next($request);

        $this->applyCsp($request, $response, $nonce);
        $this->applyHsts($request, $response);

        return $response;
    }

    /**
     * Content-Security-Policy: строгая для приложения,
     * ослабленная для страницы оплаты.
     *
     * @param Request $request текущий запрос
     * @param Response $response ответ
     * @param string $nonce nonce текущего запроса
     */
    private function applyCsp(Request $request, Response $response, string $nonce): void
    {
        if (!config('security.csp_enabled', false)) {
            return;
        }

        $relaxed = $request->routeIs('cashier.*');

        $script = ["'self'", "'nonce-{$nonce}'"];
        // Telegram Mini App (@U1ove_bot): telegram-web-app.js грузится
        // синхронно в head (app.blade.php) — без этого хоста в проде
        // (csp_enabled) скрипт режется, ready/expand не вызываются,
        // мост не стартует и автовход по initData не работает.
        $script[] = 'https://telegram.org';
        // Хосты счётчиков из панели SEO (Google/Yandex/Meta/VK): их внешние
        // <script src> должны проходить script-src без правки кода.
        // Cloudflare Turnstile (капча на гостевых формах): скрипт виджета
        // и его challenge-iframe обязаны проходить CSP, иначе виджет
        // не рендерится и регистрация/восстановление встают.
        $turnstileHost = 'https://challenges.cloudflare.com';
        $analyticsScripts = [
            'https://www.googletagmanager.com',
            'https://www.google-analytics.com',
            'https://googletagmanager.com',
            'https://mc.yandex.ru',
            'https://yandex.ru',
            'https://connect.facebook.net',
            'https://vk.com',
        ];
        $style = ["'self'", "'unsafe-inline'", 'https://fonts.bunny.net', 'https://fonts.googleapis.com'];
        $connect = [
            "'self'",
            'https:',
            'wss:',
            'https://nominatim.openstreetmap.org',
            'https://tile.openstreetmap.org',
            'https://*.tile.openstreetmap.org',
            'https://basemaps.cartocdn.com',
            'https://demotiles.maplibre.org',
            'https://www.google-analytics.com',
            'https://*.google-analytics.com',
            'https://mc.yandex.ru',
            'https://yandex.ru',
        ];
        $img = [
            "'self'",
            'data:',
            'blob:',
            // Любой https: картинки/шрифты скрипты не исполняют, а хосты
            // хранилищ и CDN-редиректы заранее не перечислить (S3, бани…).
            'https:',
            'https://tile.openstreetmap.org',
            'https://*.tile.openstreetmap.org',
            'https://basemaps.cartocdn.com',
            'https://demotiles.maplibre.org',
            // pravatar/unsplash убраны: фото лендинга теперь локальные
            // (`public/landing/`). ui-avatars оставлен — фолбэк аватарок
            // без фото (`useAvatar.ts`) по-прежнему внешний.
            'https://ui-avatars.com',
            'https://mc.yandex.ru',
        ];
        $frame = ["'self'"];
        $script[] = $turnstileHost;
        $connect[] = $turnstileHost;
        $frame[] = $turnstileHost;

        foreach ($analyticsScripts as $analyticsHost) {
            $script[] = $analyticsHost;
        }

        // Счётчики из панели SEO (GTM/GA/Yandex/FB) грузят внешние tag.js,
        // которые затем исполняют динамический инлайн-код (yandex `prepare.js`
        // и вебвизор так и делают): без 'unsafe-inline' консоль завалена
        // `Executing inline script violates ... script-src`, а метрика молчит.
        // Наш собственный инлайн при этом остаётся подписанным nonce.
        if (self::hasAnalyticsScripts()) {
            $script[] = "'unsafe-inline'";
        }

        // Произвольные скрипты из панели SEO (админ осознанно включил):
        // их инлайн-код без nonce требует 'unsafe-inline' — добавляем
        // только когда админ реально сохранил кастомный код, иначе
        // политика остаётся строгой (nonce-only).
        if (self::hasCustomSeoScripts()) {
            $script[] = "'unsafe-inline'";
        }

        if ($relaxed) {
            $script[] = 'https://cdn.jsdelivr.net';
            $script[] = 'https://js.stripe.com';
            $style[] = 'https://cdn.jsdelivr.net';
            $connect[] = 'https://api.stripe.com';
            $frame[] = 'https://js.stripe.com';
            $frame[] = 'https://hooks.stripe.com';
        }

        foreach ((array) config('security.csp_extra_connect', []) as $host) {
            $host = trim((string) $host);
            if ($host !== '') {
                $connect[] = $host;
            }
        }

        $policy = implode('; ', [
            "default-src 'self'",
            'script-src '.implode(' ', array_unique($script)),
            'style-src '.implode(' ', array_unique($style)),
            "font-src 'self' https://fonts.bunny.net https: data:",
            'img-src '.implode(' ', array_unique($img)),
            "media-src 'self' https: blob: data:",
            'connect-src '.implode(' ', array_unique($connect)),
            "worker-src 'self' blob:",
            'frame-src '.implode(' ', array_unique($frame)),
            "frame-ancestors 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            'upgrade-insecure-requests',
        ]);

        $response->headers->set('Content-Security-Policy', $policy);
    }

    /**
     * Включён ли хотя бы один стандартный счётчик из админки
     * (GTM/GA/Yandex/Facebook/VK ids при scripts_enabled).
     *
     * Их внешние tag.js исполняют динамический инлайн-код, который
     * nonce не покрывает — без 'unsafe-inline' браузер режет его
     * (`prepare.js: Executing inline script violates ... script-src`).
     *
     * @return bool true — ослабить script-src до 'unsafe-inline'
     */
    private static function hasAnalyticsScripts(): bool
    {
        try {
            $integrations = \App\Services\SeoSettingsService::integrations();
        } catch (\Throwable) {
            return false;
        }

        if (empty($integrations['scripts_enabled'])) {
            return false;
        }

        $keys = [
            'google_tag_manager_id',
            'google_analytics_id',
            'yandex_metrica_id',
            'facebook_pixel_id',
            'vk_pixel_id',
        ];

        foreach ($keys as $key) {
            $value = trim((string) ($integrations[$key] ?? ''));
            if ($value !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * Есть ли включённые кастомные SEO-скрипты из админки.
     *
     * @return bool true — добавить 'unsafe-inline' в script-src
     */
    private static function hasCustomSeoScripts(): bool
    {
        try {
            $integrations = \App\Services\SeoSettingsService::integrations();
        } catch (\Throwable) {
            return false;
        }

        if (empty($integrations['scripts_enabled'])) {
            return false;
        }

        $head = trim((string) ($integrations['head_scripts'] ?? ''));
        $bodyStart = trim((string) ($integrations['body_start_scripts'] ?? ''));
        $bodyEnd = trim((string) ($integrations['body_end_scripts'] ?? ''));

        return $head !== '' || $bodyStart !== '' || $bodyEnd !== '';
    }

    /**
     * HSTS только поверх HTTPS, чтобы не ломать локальный http-дев.
     *
     * @param Request $request текущий запрос
     * @param Response $response ответ
     */
    private function applyHsts(Request $request, Response $response): void
    {
        if (!$request->isSecure()) {
            return;
        }

        $maxAge = (int) config('security.hsts_max_age', 31536000);
        $response->headers->set('Strict-Transport-Security', "max-age={$maxAge}");
    }
}
