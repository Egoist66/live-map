<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Доступ к панели модерации.
 *
 * `admin` — только полные администраторы (всё можно).
 * `moderator` — модераторы и выше: админ проходит тоже,
 * потому что `User::canModerate()` включает админов.
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
        return $next($request);
    }
}
