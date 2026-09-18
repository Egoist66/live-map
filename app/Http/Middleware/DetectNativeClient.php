<?php

namespace App\Http\Middleware;

use App\Services\NativeClientDetector;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Гибкий SSR: WebView и приватные экраны идут в CSR.
 *
 * Ставится ДО HandleInertiaRequests (prepend в bootstrap/app.php):
 * тушит `inertia.ssr.enabled` до того, как Inertia решит,
 * дергать ли Node :13714, и шарит `is_native` в blade/Inertia.
 *
 * Ответ помечаем `X-UPin-SSR: bypass|active` и `X-UPin-Client`,
 * чтобы в upin-mobile было видно решение в чарльзе/logcat.
 */
class DetectNativeClient
{
    /**
     * @param NativeClientDetector $detector детектор нативного клиента
     */
    public function __construct(private readonly NativeClientDetector $detector) {}

    /**
     * Отключить SSR для натива и app-роутов, пометить ответ.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой стека
     * @return Response ответ с диагностическими заголовками
     */
    public function handle(Request $request, Closure $next): Response
    {
        $isNative = $this->detector->isNative($request);
        $shouldBypassSsr = $this->detector->shouldDisableSsr($request);

        $request->attributes->set('is_native', $isNative);
        $request->attributes->set('ssr_bypass', $shouldBypassSsr);

        view()->share('isNative', $isNative);

        if ($shouldBypassSsr) {
            config(['inertia.ssr.enabled' => false]);
        }

        /** @var Response $response */
        $response = $next($request);

        $clientName = $this->detector->clientName($request);
        $response->headers->set('X-UPin-Client', $clientName ?? ($isNative ? 'native' : 'web'));

        $ssrMode = $shouldBypassSsr ? 'bypass' : 'active';
        $response->headers->set('X-UPin-SSR', $ssrMode);

        return $response;
    }
}
