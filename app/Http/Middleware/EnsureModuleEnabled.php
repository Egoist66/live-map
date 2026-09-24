<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureModuleEnabled
{
    /**
     * Изоляция модулей на уровне роутов.
     *
     * Гости и legacy-аккаунты (enabled_modules = NULL) проходят всегда.
     * Админы и модераторы — на общих основаниях: разделы точно так же
     * включаются и выключаются в настройках «Приложение», без хардкода.
     * Остальным без включённого модуля — редирект на их стартовый экран.
     *
     * @param \Illuminate\Http\Request $request
     * @param \Closure $next
     * @param string $module ulove|upin|uflow|districts|business
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, string $module): Response
    {
        $user = $request->user();

        if (! $user) {
            return $next($request);
        }

        if ($user->enabledModules() === null) {
            return $next($request);
        }

        if ($user->isBusinessAccount() && in_array($module, ['business', 'upin'], true)) {
            return $next($request);
        }

        if ($user->hasModule($module)) {
            return $next($request);
        }

        return redirect($user->landingPath());
    }
}
