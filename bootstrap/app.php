<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*', headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO | Request::HEADER_X_FORWARDED_AWS_ELB);
        $middleware->web(prepend: [
            \App\Http\Middleware\DetectNativeClient::class,
        ]);
        $middleware->web(append: [
            \App\Http\Middleware\CheckMaintenanceMode::class,
            \App\Http\Middleware\HandleInertiaRequests::class,
            \Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets::class,
            \App\Http\Middleware\UpdateLastSeen::class,
            \App\Http\Middleware\SecurityHeaders::class,
            \App\Http\Middleware\PreventStaleDocuments::class,
        ]);

        // Gzip текстовых ответов (JSON/Inertia/HTML): жмёт поллинг карты и чата.
        // Бинарное, стримы и редиректы middleware пропускает сам.
        $middleware->append(\App\Http\Middleware\CompressResponse::class);

        // Годовой immutable-кэш версионированной статики Vite (/build/*).
        // Повторный визит не качает те же ~1.7МБ (Lighthouse cache-insight).
        $middleware->append(\App\Http\Middleware\CacheStaticAssets::class);

        // ETag/304 для GET /api/* + публичный кэш справочников (version/nbrb/reference).
        $middleware->api(append: [
            \App\Http\Middleware\CacheApiResponses::class,
        ]);

        $middleware->alias([
            'admin' => \App\Http\Middleware\AdminMiddleware::class,
            'moderator' => \App\Http\Middleware\AdminMiddleware::class.':moderator',
            'module' => \App\Http\Middleware\EnsureModuleEnabled::class,
        ]);

        $middleware->redirectGuestsTo(fn (\Illuminate\Http\Request $request) => route('login'));
        $middleware->redirectUsersTo(function (\Illuminate\Http\Request $request) {
            $u = $request->user();
            if (!$u) return route('dashboard');
            $id = $u->isAdmin() ? 'admin' : (string) $u->id;
            return route('dashboard', ['identifier' => $id]);
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        $exceptions->render(function (\Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                // Заголовки лимитера (Retry-After, X-RateLimit-*) отдаём как есть:
                // фронт useTelegramAuth спит ровно столько перед ретраем.
                return response()->json(['message' => 'Слишком много запросов. Подождите немного и попробуйте снова.'], 429, $e->getHeaders());
            }
        });
        $exceptions->render(function (\Throwable $e, Request $request) {
            // Гость на защищённом роуте (auth-middleware) обязан уехать на логин,
            // а не получить Inertia-страницу 500: AuthenticationException — не
            // HttpException, без этого гарда $status ниже посчитался бы как 500.
            // Валидацию тоже пропускаем — у неё свой редирект back с ошибками.
            if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                return null;
            }

            if ($e instanceof \Illuminate\Validation\ValidationException) {
                return null;
            }

            if ($request->is('api/*') || $request->is('build/*') || $request->expectsJson()) {
                return null;
            }
            $status = $e instanceof \Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                ? $e->getStatusCode()
                : 500;
            if (! in_array($status, [403, 404, 419, 500, 503], true)) {
                return null;
            }
            if ($status === 500 && config('app.debug')) {
                return null;
            }

            return \Inertia\Inertia::render('Error', ['status' => $status])
                ->toResponse($request)
                ->setStatusCode($status);
        });
    })->create();
