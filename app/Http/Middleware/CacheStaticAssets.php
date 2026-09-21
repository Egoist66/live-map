<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Долгий кэш для версионированной статики Vite.
 *
 * Lighthouse `cache-insight` показал `cacheLifetimeMs: 0` на всех
 * `/build/*`: повторный визит качал те же ~1.7МБ заново. Файлы Vite
 * контент-хэшированы (`app-CpHIeFep.js`) — иммутабельны по построению,
 * поэтому годовой `immutable` безопасен: новый билд = новые имена,
 * старый кэш никогда не отдаст протухший код.
 *
 * Работает, когда статику отдаёт PHP (Octane/FrankenPHP/`artisan serve`,
 * Laravel Cloud). Если фронт отдаёт nginx/Caddy напрямую — продублируй
 * там: `Cache-Control: public, max-age=31536000, immutable` для `/build/`.
 */
class CacheStaticAssets
{
    /**
     * Год в секундах для иммутабельных ассетов.
     */
    private const IMMUTABLE_MAX_AGE = 31536000;

    /**
     * Добавить Cache-Control к версионированной статике.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response ответ с заголовком кэша
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if (! $request->isMethod('GET')) {
            return $response;
        }

        $path = trim($request->path(), '/');

        $isBuildAsset = str_starts_with($path, 'build/');

        if (! $isBuildAsset) {
            return $response;
        }

        if ($response->getStatusCode() !== 200) {
            return $response;
        }

        $response->headers->set(
            'Cache-Control',
            'public, max-age='.self::IMMUTABLE_MAX_AGE.', immutable'
        );
        $response->headers->remove('Pragma');
        $response->headers->remove('Expires');

        return $response;
    }
}
