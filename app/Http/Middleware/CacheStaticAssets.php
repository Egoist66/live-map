<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Долгий кэш для версионированной статики Vite и фото лендинга.
 *
 * Lighthouse `cache-insight` показал `cacheLifetimeMs: 0` на всех
 * `/build/*`: повторный визит качал те же ~1.7МБ заново. Файлы Vite
 * контент-хэшированы (`app-CpHIeFep.js`) — иммутабельны по построению,
 * поэтому годовой `immutable` безопасен: новый билд = новые имена,
 * старый кэш никогда не отдаст протухший код.
 *
 * Фото лендинга (`/landing/*`) без хэша в имени — им месяц: меняются
 * редко, а edge Laravel Cloud сбрасывает кэш на каждом деплое, так что
 * протухший файл не залипнет. WebP-двойники (`*-560.webp`) лежат рядом.
 *
 * Работает, когда статику отдаёт PHP (Octane/FrankenPHP/`artisan serve`,
 * Laravel Cloud). Если фронт отдаёт nginx/Caddy напрямую — продублируй
 * там: `Cache-Control: public, max-age=31536000, immutable` для `/build/`
 * и `public, max-age=2592000` для `/landing/`.
 */
class CacheStaticAssets
{
    /**
     * Год в секундах для иммутабельных ассетов.
     */
    private const IMMUTABLE_MAX_AGE = 31536000;

    /**
     * Месяц в секундах для нехэшированной статики лендинга.
     */
    private const LANDING_MAX_AGE = 2592000;

    /**
     * Добавить Cache-Control к версионированной статике и фото лендинга.
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

        if ($response->getStatusCode() !== 200) {
            return $response;
        }

        $path = trim($request->path(), '/');

        $cacheControl = $this->cacheControlFor($path);

        if ($cacheControl === null) {
            return $response;
        }

        $response->headers->set('Cache-Control', $cacheControl);
        $response->headers->remove('Pragma');
        $response->headers->remove('Expires');

        return $response;
    }

    /**
     * Подобрать Cache-Control по пути (null — не кэшируем на клиенте).
     *
     * @param string $path путь запроса без слэшей по краям
     * @return string|null значение заголовка
     */
    private function cacheControlFor(string $path): ?string
    {
        $isBuildAsset = str_starts_with($path, 'build/');

        if ($isBuildAsset) {
            return 'public, max-age='.self::IMMUTABLE_MAX_AGE.', immutable';
        }

        $isLandingImage = str_starts_with($path, 'landing/');

        if ($isLandingImage) {
            return 'public, max-age='.self::LANDING_MAX_AGE;
        }

        return null;
    }
}
