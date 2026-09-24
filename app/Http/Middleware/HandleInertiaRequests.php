<?php

namespace App\Http\Middleware;

use App\Services\AppVersionService;
use App\Services\SeoSettingsService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @param Request $request текущий запрос
     * @return array<string, mixed> общие пропсы Inertia
     */
    public function share(Request $request): array
    {
        $isNative = (bool) $request->attributes->get('is_native', false);

        $shared = [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user(),
                'impersonating' => session()->has('impersonator_id'),
                'impersonator_id' => session('impersonator_id'),
            ],
            'unreadCount' => $request->user() ? $request->user()->unreadMessagesCount() : 0,
            'appVersion' => AppVersionService::version(),
            'seo' => function () use ($request) {
                $path = '/' . ltrim($request->path(), '/');

                if ($path === '//') {
                    $path = '/';
                }

                return SeoSettingsService::forInertia($path);
            },
            'client' => [
                'isNative' => $isNative,
                'ssrBypass' => (bool) $request->attributes->get('ssr_bypass', false),
                'side' => self::guestSide($request),
            ],
            // Роуты для ZiggyVue в SSR (resources/js/ssr.ts): Node-процесс
            // не видит blade-скрипт @routes, без этого route()/current() падают
            // и Inertia молча откатывается в CSR (пустой div#app).
            'ziggy' => function () use ($request) {
                return array_merge((new \Tighten\Ziggy\Ziggy)->toArray(), [
                    'location' => $request->url(),
                ]);
            },
        ];

        return $shared;
    }

    /**
     * Выбранная гостем сторона приложения из cookie для SSR.
     *
     * Сервер не видит localStorage, а auth-страницы (вход/регистрация)
     * темизируются по запомненному табу лендинга. Без этой подсказки
     * SSR рендерит тему по умолчанию — клиент после гидратации
     * перекрашивает страницу (флеш чужой иконки + mismatch).
     *
     * @param Request $request текущий запрос
     * @return string|null ulove|upin|uflow|districts|business либо null
     */
    private static function guestSide(Request $request): ?string
    {
        $side = $request->cookie('upin_side');

        if (! is_string($side)) {
            return null;
        }

        $side = strtolower(trim($side));

        $allowed = ['ulove', 'upin', 'uflow', 'districts', 'business'];

        if (! in_array($side, $allowed, true)) {
            return null;
        }

        return $side;
    }
}
