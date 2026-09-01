<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    public function handle(Request $request, Closure $next, string $role = 'admin'): Response
    {
        $user = $request->user();
        if (!$user) abort(401);
        if ($role === 'admin' && !$user->isAdmin()) abort(403, 'Требуются права администратора');
        if ($role === 'moderator' && !$user->canModerate()) abort(403, 'Требуются права модератора');
        return $next($request);
    }
}
