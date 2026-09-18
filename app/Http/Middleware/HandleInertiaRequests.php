<?php

namespace App\Http\Middleware;

use App\Services\AppVersionService;
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
            'client' => [
                'isNative' => $isNative,
                'ssrBypass' => (bool) $request->attributes->get('ssr_bypass', false),
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
}
