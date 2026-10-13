<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * HTTP-кэширование для API: ETag/304 для всех GET и Cache-Control для публичных.
 *
 * Что делает:
 * - каждому `GET /api/*` с кодом 200 ставит ETag по хэшу тела и отвечает
 *   `304 Not Modified` на `If-None-Match` — повторный поллинг с тем же
 *   состоянием стоит 0 байт тела;
 * - публичным справочникам (`version`, `reference*`) ставит
 *   `Cache-Control: public, max-age=300` — их кэширует CDN/браузер;
 * - персонализированные ответы (`pins`, `chat`, …) публичным кэшем не
 *   помечает — только ETag, stale-данных быть не может: 304 отдаётся
 *   лишь когда контент побайтово совпал.
 */
class CacheApiResponses
{
    /**
     * Добавить кэш-заголовки к API-ответу.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response ответ с ETag / Cache-Control
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if (! $this->shouldHandle($request, $response)) {
            return $response;
        }

        $content = (string) $response->getContent();
        $etag = '"'.md5($content).'"';
        $response->setEtag($etag);

        if ($this->isPublicPath($request)) {
            $response->headers->set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        }

        if ($response->isNotModified($request)) {
            $response->setNotModified();
        }

        return $response;
    }

    /**
     * Подходит ли пара запрос/ответ под кэширование.
     *
     * @param Request $request текущий запрос
     * @param Response $response ответ
     * @return bool true для GET 200 с текстовым телом
     */
    private function shouldHandle(Request $request, Response $response): bool
    {
        if (! $request->isMethod('GET')) {
            return false;
        }

        if ($response->getStatusCode() !== 200) {
            return false;
        }

        if ($response instanceof BinaryFileResponse || $response instanceof StreamedResponse) {
            return false;
        }

        if ($response->headers->has('Content-Encoding')) {
            return false;
        }

        $content = $response->getContent();
        if (! is_string($content) || $content === '') {
            return false;
        }

        $mime = strtolower((string) $response->headers->get('Content-Type', ''));
        if ($mime !== '' && ! str_contains($mime, 'json') && ! str_contains($mime, 'text/')) {
            return false;
        }

        return true;
    }

    /**
     * Публичный ли путь (можно кэшировать на CDN).
     *
     * @param Request $request текущий запрос
     * @return bool true для version/reference
     */
    private function isPublicPath(Request $request): bool
    {
        $path = trim($request->path(), '/');
        if (! str_starts_with($path, 'api/')) {
            return false;
        }

        $relative = substr($path, strlen('api/'));

        return $relative === 'version'
            || str_starts_with($relative, 'reference');
    }
}
