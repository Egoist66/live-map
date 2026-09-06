<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if ($user && $user->banned_at) {
            \Illuminate\Support\Facades\Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            abort(403, 'Аккаунт заблокирован. Обратитесь к администратору.');
        }
        $response = $next($request);
        if ($user && !$user->isInvisibleActive()) {
            $key = 'last_seen:'.$user->id;
            if (!Cache::has($key)) {
                $user->forceFill(['last_seen_at' => now()])->saveQuietly();
                Cache::put($key, true, 120);
            }
        }
        return $response;
    }
}
