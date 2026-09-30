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
        if ($user && self::deviceBlocked($request, (int) $user->id)) {
            \Illuminate\Support\Facades\Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            abort(403, 'Это устройство заблокировано владельцем аккаунта.');
        }
        $response = $next($request);
        // Beacon закрытия Mini App (POST /api/chat/offline) сам ставит
        // last_seen_at в прошлое — не затираем его свежим now(), иначе
        // Telegram-дубли снова задержатся на 3 минуты порога isAway.
        if ($request->is('api/chat/offline')) {
            return $response;
        }
        if ($user && !$user->isInvisibleActive()) {
            $key = 'last_seen:'.$user->id;
            if (!Cache::has($key)) {
                $user->forceFill(['last_seen_at' => now()])->saveQuietly();
                Cache::put($key, true, 120);
            }
        }
        return $response;
    }

    /**
     * Заблокировано ли текущее устройство владельцем (кэш 60с).
     *
     * Бэкстоп на случай гонки: блокировка всегда сначала удаляет
     * строку сессии, сюда доходят лишь чудом уцелевшие запросы.
     *
     * @param Request $request текущий запрос
     * @param int $userId id пользователя
     * @return bool true когда устройство в вечном бане
     */
    private static function deviceBlocked(Request $request, int $userId): bool
    {
        try {
            $fp = \App\Services\DeviceFingerprint::fingerprintOnly($request);
            $key = 'dev:blocked:'.$userId.':'.$fp['fingerprint'];

            $blocked = Cache::remember($key, 60, function () use ($userId, $fp) {
                try {
                    return \App\Models\UserDevice::where('user_id', $userId)
                        ->where('fingerprint', $fp['fingerprint'])
                        ->where('blocked', true)
                        ->exists();
                } catch (\Throwable) {
                    return false;
                }
            });

            return (bool) $blocked;
        } catch (\Throwable) {
            return false;
        }
    }
}
