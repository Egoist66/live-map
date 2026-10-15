<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Лёгкий антибот-фильтр уровня приложения (поверх nginx limit_req
 * и Laravel throttle — те режут частоту, этот режет очевидных ботов).
 *
 * Что делает:
 * - режет писательные запросы (POST/PUT/PATCH/DELETE) без User-Agent
 *   либо с UA сканеров/эксплойт-китов (sqlmap, nikto, masscan…);
 * - режет классические probe-пути сканеров (.php, .env, wp-admin…)
 *   до того, как они дойдут до роутера и логов 404;
 * - легитимных краулеров (Googlebot/Yandex/Bing) НЕ трогает на GET —
 *   им отдаёт robots/sitemap и публичные страницы как раньше.
 *
 * Не трогает: health (/up), статику (/build/*, /landing/*, sw),
 * WebSocket Reverb (/app) и сами страницы (GET): скраппинг чтения
 * давится throttle-лимитерами и авторизацией тяжёлых ручек.
 */
class BlockBadBots
{
    /**
     * Подстроки UA сканеров, брутфорсеров и скраппер-инфраструктуры.
     *
     * @var string[]
     */
    private const BAD_UA_PARTS = [
        'sqlmap',
        'nikto',
        'nmap',
        'masscan',
        'nessus',
        'openvas',
        'acunetix',
        'netsparker',
        'hydra',
        'medusa',
        'ncrack',
        'metasploit',
        'burpsuite',
        'burp suite',
        'zap/',
        'owasp zap',
        'dirbuster',
        'gobuster',
        'dirsearch',
        'wpscan',
        'whatweb',
        'zgrab',
        'censys',
        'shodan',
        'binaryedge',
        'stretchoid',
        'python-requests/1',
        'python-requests/2.0',
        'libwww-perl',
        'lwp-trivial',
        'curl/7.0',
    ];

    /**
     * Префиксы probe-путей, которых в приложении нет и быть не должно.
     *
     * @var string[]
     */
    private const PROBE_PATH_PREFIXES = [
        '/.env',
        '/.git/',
        '/wp-admin',
        '/wp-login',
        '/wp-content',
        '/xmlrpc.php',
        '/phpmyadmin',
        '/phpMyAdmin',
        '/.php',
        '/actuator',
        '/console/',
        '/_ignition',
        '/debug/',
    ];

    /**
     * Суффиксы probe-файлов (брутфорс бэкдоров/шеллов).
     *
     * @var string[]
     */
    private const PROBE_SUFFIXES = [
        '.php',
        '.asp',
        '.aspx',
        '.jsp',
        '.cgi',
    ];

    /**
     * Отфильтровать очевидных ботов до роутера.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response ответ либо пропуск дальше
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->isExempt($request)) {
            return $next($request);
        }

        if ($this->isProbePath($request)) {
            $this->logBlocked($request, 'probe-path');

            return $this->deny($request);
        }

        if ($this->isWriteRequest($request) && $this->isBadBot($request)) {
            $this->logBlocked($request, 'bad-ua');

            return $this->deny($request);
        }

        return $next($request);
    }

    /**
     * Пути вне фильтра: health, статика, WebSocket, сами ассеты.
     *
     * @param Request $request текущий запрос
     * @return bool true — пропустить без проверок
     */
    private function isExempt(Request $request): bool
    {
        $path = '/'.ltrim($request->path(), '/');

        $exemptPrefixes = [
            '/up',
            '/build/',
            '/landing/',
            '/app',
        ];

        foreach ($exemptPrefixes as $prefix) {
            if ($path === $prefix || str_starts_with($path, $prefix)) {
                return true;
            }
        }

        $exemptExact = [
            '/sw.js',
            '/push-sw.js',
            '/favicon.ico',
            '/manifest.webmanifest',
            '/robots.txt',
            '/sitemap.xml',
        ];

        if (in_array($path, $exemptExact, true)) {
            return true;
        }

        if (preg_match('#^/workbox-[^/]+\.js$#', $path) === 1) {
            return true;
        }

        return false;
    }

    /**
     * Запрос похож на сканирование уязвимостей (пути, которых нет в app).
     *
     * @param Request $request текущий запрос
     * @return bool true — probe, резать
     */
    private function isProbePath(Request $request): bool
    {
        $path = '/'.ltrim($request->path(), '/');
        $lower = mb_strtolower($path);

        foreach (self::PROBE_PATH_PREFIXES as $prefix) {
            $prefixLower = mb_strtolower($prefix);

            if ($lower === rtrim($prefixLower, '/') || str_starts_with($lower, $prefixLower)) {
                return true;
            }
        }

        foreach (self::PROBE_SUFFIXES as $suffix) {
            if (str_ends_with($lower, $suffix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Писательный ли метод (меняет состояние — ботам туда нельзя без UA).
     *
     * @param Request $request текущий запрос
     * @return bool true — POST/PUT/PATCH/DELETE
     */
    private function isWriteRequest(Request $request): bool
    {
        return in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true);
    }

    /**
     * UA отсутствует либо принадлежит сканеру.
     *
     * Пустой UA на чтении (GET) разрешён: так ходят нативные клиенты,
     * curl-здоровье и часть мобильных сетей. На записи — запрещён.
     *
     * @param Request $request текущий запрос
     * @return bool true — очевидный бот
     */
    private function isBadBot(Request $request): bool
    {
        $ua = trim((string) $request->userAgent());

        if ($ua === '' || mb_strlen($ua) < 10) {
            return true;
        }

        $lower = mb_strtolower($ua);

        foreach (self::BAD_UA_PARTS as $part) {
            if (str_contains($lower, $part)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Записать блокировку в лог (для будущей IP-брони в fail2ban/Cloudflare).
     *
     * @param Request $request заблокированный запрос
     * @param string $reason probe-path|bad-ua
     * @return void
     */
    private function logBlocked(Request $request, string $reason): void
    {
        Log::warning('bot blocked', [
            'reason' => $reason,
            'ip' => $request->ip(),
            'method' => $request->method(),
            'path' => $request->path(),
            'ua' => mb_substr((string) $request->userAgent(), 0, 256),
        ]);
    }

    /**
     * Ответить 403 в формате запроса (JSON для API, пусто для сканеров).
     *
     * @param Request $request текущий запрос
     * @return Response 403
     */
    private function deny(Request $request): Response
    {
        $isApi = $request->is('api/*') || $request->expectsJson();

        if ($isApi) {
            return response()->json(['message' => 'Доступ отклонён автоматическим фильтром.'], 403);
        }

        abort(403);

        return response('', 403);
    }
}
