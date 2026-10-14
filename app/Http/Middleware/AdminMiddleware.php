<?php

namespace App\Http\Middleware;

use App\Services\NativeClientDetector;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Доступ к панели модерации.
 *
 * `admin` — только полные администраторы (всё можно).
 * `moderator` — модераторы и выше: админ проходит тоже,
 * потому что `User::canModerate()` включает админов.
 *
 * Модерация — только из браузера (десктоп или мобильный):
 * Telegram Mini App и мобильную WebView режем здесь же —
 * одним махом закрыты и страница `/admin/*`, и все `/api/admin/*`.
 */
class AdminMiddleware
{
    /**
     * Проверить права staff-пользователя.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой
     * @param string $role требуемый уровень: admin|moderator
     * @return Response
     *
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException 401 без логина, 403 без роли
     */
    public function handle(Request $request, Closure $next, string $role = 'admin'): Response
    {
        $user = $request->user();
        if (!$user) abort(401);
        if ($role === 'admin' && !$user->isAdmin()) abort(403, 'Требуются права администратора');
        if ($role === 'moderator' && !$user->canModerate()) abort(403, 'Требуются права модератора');
        if (app(NativeClientDetector::class)->isNative($request)) {
            abort(403, 'Панель модерации доступна только в браузере — на десктопе или в мобильном браузере.');
        }
        return $next($request);
    }
}
