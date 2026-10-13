<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Запрет кэширования HTML-документов и Inertia-ответов.
 *
 * После каждого деплоя хэши `public/build/assets/*` меняются, а старые файлы
 * удаляются. Протухший закэшированный HTML ссылается на уже несуществующий
 * entry (`app-*.js` 404) — JS не грузится вообще, страница белая, а кнопка
 * «назад» показывает тот же мёртвый HTML (bfcache/SW/HTTP-кэш).
 *
 * `no-cache` заставляет браузер и edge всегда ревалидировать документ
 * (304 при неизменности — почти бесплатно), но оставляет страницу
 * пригодной для bfcache (в отличие от `no-store`, который его убивает).
 * Версионированная статика (`/build/*`, immutable на год) и API под этот
 * запрет не попадают — их кэшируют свои middleware.
 */
class PreventStaleDocuments
{
    /**
     * Добавить запрет кэширования к документам.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response ответ с политикой кэширования документов
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if ($this->isDocument($request, $response)) {
            $response->headers->set('Cache-Control', 'no-cache, private, must-revalidate');
        }

        return $response;
    }

    /**
     * Это кэшируемый документ, а не статика/API/ошибка.
     *
     * @param Request $request текущий запрос
     * @param Response $response ответ нижележащих слоёв
     * @return bool true — HTML 200 или Inertia-JSON, ревалидировать всегда
     */
    private function isDocument(Request $request, Response $response): bool
    {
        if (!$request->isMethod('GET')) {
            return false;
        }

        if ($response->getStatusCode() !== 200) {
            return false;
        }

        if ($request->is('build/*', 'api/*', 'broadcasting/*', 'reverb/*', 'storage/*', 'up', 'sw.js', 'manifest.webmanifest')) {
            return false;
        }

        $isInertiaVisit = $request->header('X-Inertia') !== null;

        if ($isInertiaVisit) {
            return true;
        }

        $contentType = (string) $response->headers->get('Content-Type', '');

        return str_contains($contentType, 'text/html');
    }
}
