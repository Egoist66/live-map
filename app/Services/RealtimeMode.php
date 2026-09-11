<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * Временный переключатель транспорта realtime.
 *
 * socket  — штатный режим через Reverb-сокеты.
 * polling — запасной REST-поллинг, пока упираемся в лимит соединений.
 * Флаг живёт в кэше, переживает редеплои, меняется из админки.
 */
class RealtimeMode
{
    public const SOCKET = 'socket';

    public const POLLING = 'polling';

    private const KEY = 'realtime.mode';

    /**
     * Текущий режим realtime.
     *
     * @return string socket|polling
     */
    public static function get(): string
    {
        $mode = Cache::get(self::KEY, self::SOCKET);

        return $mode === self::POLLING ? self::POLLING : self::SOCKET;
    }

    /**
     * Установить режим realtime.
     *
     * @param string $mode socket|polling
     */
    public static function set(string $mode): string
    {
        $resolved = $mode === self::POLLING ? self::POLLING : self::SOCKET;
        Cache::forever(self::KEY, $resolved);

        return $resolved;
    }

    /**
     * Включён ли запасной поллинг.
     */
    public static function isPolling(): bool
    {
        return self::get() === self::POLLING;
    }
}
