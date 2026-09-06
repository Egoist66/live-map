<?php

namespace App\Http\Middleware;

use App\Services\AppSettings;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CheckMaintenanceMode
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->routeIs('login') || $request->is('login')) return $next($request);
        if (!AppSettings::maintenanceEnabled()) return $next($request);
        $user = $request->user();
        if ($user && $user->isAdmin()) return $next($request);
        if ($request->expectsJson()) {
            return response()->json(['message' => 'Приложение на обслуживании. Попробуйте позже.'], 503);
        }
        return Inertia::render('Maintenance', AppSettings::maintenancePage())
            ->toResponse($request)
            ->setStatusCode(503);
    }
}
