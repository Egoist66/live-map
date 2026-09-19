<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Gzip/deflate-сжатие текстовых ответов.
 *
 * Octane отдаёт JSON/Inertia напрямую, а nginx перед ним без `gzip on` —
 * каждый поллинг карты и чата едет несжатым. Middleware жмёт ответ
 * в памяти (уровень 6 — баланс CPU/размер) и ставит `Content-Encoding`.
 *
 * Безопасность по построению, ничего не ломает:
 * - бинарное (картинки, аудио, zip, файлы) и стримы не трогает;
 * - редиректы, 204/304 и пустые тела пропускает;
 * - уже закодированные ответы не пережимает;
 * - клиент без `Accept-Encoding: gzip` получает как было.
 */
class CompressResponse
{
    /**
     * Минимальный размер тела для сжатия: меньше — накладные расходы gzip.
     */
    private const MIN_LENGTH = 1024;

    /**
     * Сжать ответ, если это выгодно и безопасно.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response сжатый или исходный ответ
     */
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        if (! $this->shouldCompress($request, $response)) {
            return $response;
        }

        $encoding = $this->negotiate($request);
        if ($encoding === null) {
            return $response;
        }

        $content = (string) $response->getContent();
        $compressed = $encoding === 'gzip' ? gzencode($content, 6) : gzdeflate($content, 6);
        if (! is_string($compressed) || strlen($compressed) >= strlen($content)) {
            return $response;
        }

        $response->setContent($compressed);
        $response->headers->set('Content-Encoding', $encoding);
        $response->headers->set('Vary', $this->varyValue($response));
        $response->headers->remove('Content-Length');

        return $response;
    }

    /**
     * Можно ли сжимать этот ответ.
     *
     * @param Request $request текущий запрос
     * @param Response $response ответ
     * @return bool true когда сжатие безопасно
     */
    private function shouldCompress(Request $request, Response $response): bool
    {
        if ($response instanceof BinaryFileResponse || $response instanceof StreamedResponse) {
            return false;
        }

        if ($response->headers->has('Content-Encoding')) {
            return false;
        }

        $status = $response->getStatusCode();
        if ($status < 200 || $status >= 300 || in_array($status, [204, 304], true)) {
            return false;
        }

        $content = $response->getContent();
        if (! is_string($content) || strlen($content) < self::MIN_LENGTH) {
            return false;
        }

        $mime = strtolower((string) $response->headers->get('Content-Type', ''));
        if ($mime === '') {
            return str_starts_with(ltrim($content), '{') || str_starts_with(ltrim($content), '<');
        }

        $textual = ['application/json', 'text/', 'application/javascript', 'application/xml', 'image/svg+xml'];
        foreach ($textual as $prefix) {
            if (str_contains($mime, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Выбрать кодировку по Accept-Encoding клиента.
     *
     * @param Request $request текущий запрос
     * @return string|null 'gzip', 'deflate' или null
     */
    private function negotiate(Request $request): ?string
    {
        $header = strtolower($request->headers->get('Accept-Encoding', ''));
        if (str_contains($header, 'gzip')) {
            return 'gzip';
        }
        if (str_contains($header, 'deflate')) {
            return 'deflate';
        }

        return null;
    }

    /**
     * Добавить Accept-Encoding в Vary, не затирая существующее.
     *
     * @param Response $response ответ
     * @return string значение Vary
     */
    private function varyValue(Response $response): string
    {
        $current = (string) $response->headers->get('Vary', '');
        if ($current === '' || $current === '*') {
            return $current === '' ? 'Accept-Encoding' : $current;
        }
        if (stripos($current, 'Accept-Encoding') !== false) {
            return $current;
        }

        return $current.', Accept-Encoding';
    }
}
