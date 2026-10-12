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
        $isTelegram = (bool) $request->attributes->get('is_telegram', false);

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
                'isTelegram' => $isTelegram,
                'telegramBot' => config('telegram.bot_username', 'U1ove_bot'),
                'ssrBypass' => (bool) $request->attributes->get('ssr_bypass', false),
                'side' => self::guestSide($request),
            ],
            'support' => [
                'email' => config('seo.support_email', config('mail.from.address')),
            ],
            'globalModules' => function () {
                try {
                    return \App\Services\AppSettings::globalModules();
                } catch (\Throwable) {
                    return ['ulove'];
                }
            },
            'aiEnabled' => function () {
                try {
                    return \App\Services\AppSettings::isAiEnabled();
                } catch (\Throwable) {
                    return false;
                }
            },
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
     * Сторона приложения для SSR.
     *
     * Механика запоминания таба убрана по ТЗ: стартовая страница —
     * всегда ULove, auth-формы — всегда в стиле ULove. Cookie
     * `upin_side` больше не влияет на тему, сервер всегда отдаёт
     * `ulove`, чтобы первый кадр был ровным и без флеша чужой темы.
     *
     * @param Request $request текущий запрос
     * @return string всегда ulove
     */
    private static function guestSide(Request $request): ?string
    {
        return 'ulove';
    }
}
