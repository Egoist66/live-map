<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class UpdateLastSeen
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        $user = $request->user();
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
