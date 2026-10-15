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
     * Не-стаффа со страницы тихо уводим в его профиль (редирект),
     * а не на 403 «Сюда нельзя»: страница-заглушка сама по себе
     * палит существование админки. API и JSON-запросы по-прежнему
     * получают честный 403 — редирект там бессмысленен.
     *
     * @param Request $request текущий запрос
     * @param Closure $next следующий слой
     * @param string $role требуемый уровень: admin|moderator
     * @return Response
     *
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException 401 без логина, 403 без роли (API/JSON)
     */
    public function handle(Request $request, Closure $next, string $role = 'admin'): Response
    {
        $user = $request->user();
        if (!$user) abort(401);
        if ($role === 'admin' && !$user->isAdmin()) {
            return $this->deny($request, 'Требуются права администратора');
        }
        if ($role === 'moderator' && !$user->canModerate()) {
            return $this->deny($request, 'Требуются права модератора');
        }
        if (app(NativeClientDetector::class)->isNative($request)) {
            abort(403, 'Панель модерации доступна только в браузере — на десктопе или в мобильном браузере.');
        }
        return $next($request);
    }

    /**
     * Отказать в доступе: редирект в профиль для страниц, 403 для API.
     *
     * @param Request $request текущий запрос
     * @param string $message причина для API-ответа
     * @return Response
     *
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException 403 для API/JSON
     */
    private function deny(Request $request, string $message): Response
    {
        if ($request->is('api/*') || $request->expectsJson()) {
            abort(403, $message);
        }

        return redirect('/profile');
    }
}
