<?php

namespace App\Services;

use App\Events\SessionRevoked;
use App\Models\User;
use App\Models\UserDevice;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Мгновенное убийство web-сессий устройства.
 *
 * Единая механика для Mini App (DeviceController) и Telegram-бота
 * (TelegramSessionActions): гасим привязанную строку sessions
 * и всегда добиваем сиротские сессии владельца (чужак мог остаться
 * в аккаунте через сессию без устройства — один отпечаток делят
 * все одинаковые браузеры, а session_id хранит только последний
 * вход, поэтому убивать только привязанную строку нельзя).
 * Всё убитое летит в SessionRevoked одним broadcast — жертва
 * вылетает из приложения сразу, запасной путь — 401 поллера.
 */
class DeviceSessionRevoker
{
    /**
     * Убить сессии устройства: привязанную + все сиротские владельца.
     *
     * Сирот добиваем всегда, а не только при промахе: маппинг
     * session_id хранит лишь последний вход с отпечатка (один
     * отпечаток делят все одинаковые браузеры), чужак почти
     * наверняка сидит через непривязанную сессию — иначе килл
     * бьёт по последнему вошедшему (часто по самой жертве),
     * а intruder остаётся в аккаунте.
     *
     * @param User $user владелец
     * @param UserDevice $device устройство
     * @return array<int, string> id убитых сессий
     */
    public static function revokeDeviceSessions(User $user, UserDevice $device): array
    {
        $killed = [];
        $sessionId = (string) ($device->session_id ?? '');

        if ($sessionId !== '') {
            $deleted = DB::table('sessions')
                ->where('id', $sessionId)
                ->where('user_id', (int) $user->id)
                ->delete();

            if ($deleted > 0) {
                $killed[] = $sessionId;
            }
        }

        $orphans = self::orphanSessionIds($user);
        $freshOrphans = array_values(array_diff($orphans, $killed));

        if ($freshOrphans !== []) {
            DB::table('sessions')->whereIn('id', $freshOrphans)->delete();
            $killed = array_merge($killed, $freshOrphans);
        }

        $killed = array_values(array_unique($killed));

        if ($killed !== []) {
            try {
                broadcast(new SessionRevoked((int) $user->id, $killed));
            } catch (\Throwable) {
                // No-op: строки уже удалены, поллер добьёт 401.
            }
        }

        return $killed;
    }

    /**
     * Сиротские web-сессии владельца (не привязаны ни к устройству).
     *
     * @param User $user владелец
     * @return array<int, string> id строк sessions
     */
    public static function orphanSessionIds(User $user): array
    {
        $userId = (int) $user->id;

        $known = UserDevice::where('user_id', $userId)
            ->whereNotNull('session_id')
            ->pluck('session_id')
            ->map(fn ($id): string => (string) $id)
            ->filter()
            ->values()
            ->all();

        $query = DB::table('sessions')->where('user_id', $userId);

        if ($known !== []) {
            $query->whereNotIn('id', $known);
        }

        try {
            return $query->pluck('id')
                ->map(fn ($id): string => (string) $id)
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Сбросить кэш бана отпечатка, чтобы запрет вступил мгновенно.
     *
     * Middleware кэширует проверку на 60с: без сброса забаненное
     * устройство ещё минуту проходило бы по старому кэшу.
     *
     * @param int $userId владелец
     * @param string $fingerprint отпечаток устройства
     * @return void
     */
    public static function forgetBlockedCache(int $userId, string $fingerprint): void
    {
        if (trim($fingerprint) === '') {
            return;
        }

        try {
            Cache::forget('dev:blocked:'.$userId.':'.$fingerprint);
        } catch (\Throwable) {
            // No-op: кэш сам протухнет за минуту.
        }
    }
}
