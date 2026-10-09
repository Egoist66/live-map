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
     * Сначала глобальный гейт администратора: выключенный глобально
     * раздел недоступен никому (кроме ULove, он всегда включён) —
     * редирект на стартовый экран. Дальше — персональный набор:
     * гости и legacy-аккаунты (enabled_modules = NULL) проходят всегда.
     * Админы и модераторы — на общих основаниях, без хардкода.
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

        if ($module !== 'ulove' && ! \App\Services\AppSettings::isModuleGloballyEnabled($module)) {
            return redirect($user->landingPath());
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
