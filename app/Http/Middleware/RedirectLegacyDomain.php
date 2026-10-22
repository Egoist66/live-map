<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Постоянный редирект со старых доменов на канонический.
 *
 * Старый домен `upin.laravel.cloud` продолжает открываться у части пользователей
 * (закладки, PWA, старые ссылки), но продукт теперь живёт на `ulove.laravel.cloud`.
 * Middleware ловит запросы к legacy-хостам и уводит их на канонический хост
 * из `config('app.url')`, сохраняя путь и query-строку.
 *
 * Список старых хостов задаётся в `APP_LEGACY_HOSTS` (через запятую),
 * по умолчанию — `upin.laravel.cloud`. Пустой `APP_URL` или его отсутствие
 * в списке legacy-хостов отключают редирект, поэтому петли невозможны.
 */
class RedirectLegacyDomain
{
    /**
     * Увести запрос с legacy-домена на канонический.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response редирект на канонический хост либо обычный ответ
     */
    public function handle(Request $request, Closure $next): Response
    {
        $canonical = $this->canonicalUrl($request);

        if ($canonical === null) {
            return $next($request);
        }

        $status = $request->isMethod('GET') || $request->isMethod('HEAD') ? 301 : 308;

        return redirect()->away($canonical, $status);
    }

    /**
     * Собрать канонический URL запроса или вернуть null, если редирект не нужен.
     *
     * @param Request $request текущий запрос
     * @return string|null абсолютный URL на новом домене
     */
    private function canonicalUrl(Request $request): ?string
    {
        $legacyHosts = $this->legacyHosts();

        if ($legacyHosts === []) {
            return null;
        }

        $requestHost = mb_strtolower($request->getHost());

        if (! in_array($requestHost, $legacyHosts, true)) {
            return null;
        }

        $appUrl = (string) config('app.url');
        $canonicalHost = parse_url($appUrl, PHP_URL_HOST);

        if (! is_string($canonicalHost) || $canonicalHost === '') {
            return null;
        }

        $canonicalHost = mb_strtolower($canonicalHost);

        if ($canonicalHost === $requestHost) {
            return null;
        }

        $canonicalScheme = parse_url($appUrl, PHP_URL_SCHEME) ?: $request->getScheme();
        $query = $request->getQueryString();
        $suffix = $query === null ? '' : '?'.$query;

        return $canonicalScheme.'://'.$canonicalHost.$request->getPathInfo().$suffix;
    }

    /**
     * Список legacy-хостов из конфигурации.
     *
     * @return string[] нормализованные хосты в нижнем регистре
     */
    private function legacyHosts(): array
    {
        $configured = (string) config('app.legacy_hosts', '');

        $hosts = array_map(
            static fn (string $host): string => mb_strtolower(trim($host)),
            explode(',', $configured),
        );

        return array_values(array_filter($hosts));
    }
}
