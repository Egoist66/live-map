<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserDevice;

/**
 * Действия панели сеансов в боте: завершить / забанить / разбанить.
 *
 * Сам килл — через DeviceSessionRevoker (та же механика, что у
 * DeviceController в Mini App: удаление строк sessions + broadcast
 * SessionRevoked в личный канал — жертва вылетает мгновенно,
 * запасной путь — 401 поллера), здесь только точка входа —
 * callback_query бота, а не web-сессия. Поэтому владельца ищем
 * строго по паре (device_id + user_id): чужой девайс не дёрнуть.
 */
class TelegramSessionActions
{
    /**
     * Завершить сеанс устройства без блокировки.
     *
     * Бьём не только привязанную строку, но и сиротские сессии
     * владельца, когда привязанной уже нет: чужак мог остаться
     * в аккаунте через сессию без устройства — terminate добивает
     * их сам. Всё убитое летит в SessionRevoked — жертва вылетает
     * из приложения мгновенно, запасной путь — 401 поллера.
     *
     * @param User $user владелец (найден по telegram_id из апдейта)
     * @param int $deviceId id устройства из callback_data
     * @return array{ok:bool, message:string} итог для тоста
     */
    public static function terminate(User $user, int $deviceId): array
    {
        $device = self::owned($user, $deviceId);

        if ($device === null) {
            return ['ok' => false, 'message' => 'Устройство не найдено'];
        }

        $killed = DeviceSessionRevoker::revokeDeviceSessions($user, $device);

        if ($killed === []) {
            return ['ok' => true, 'message' => 'Сеанс уже закрыт: '.$device->label()];
        }

        if (count($killed) === 1) {
            return ['ok' => true, 'message' => 'Сеанс завершён: '.$device->label()];
        }

        return ['ok' => true, 'message' => 'Сеанс завершён: '.$device->label().' (закрыто: '.count($killed).')'];
    }

    /**
     * Забанить устройство навсегда + мгновенно завершить его сеанс.
     *
     * Тот же килл, что у «Завершить», плюс вечный запрет входа:
     * middleware режет любой запрос с этого отпечатка (403),
     * а форма входа не пустит заново. Разбан — кнопкой ниже.
     *
     * @param User $user владелец
     * @param int $deviceId id устройства
     * @return array{ok:bool, message:string}
     */
    public static function ban(User $user, int $deviceId): array
    {
        $device = self::owned($user, $deviceId);

        if ($device === null) {
            return ['ok' => false, 'message' => 'Устройство не найдено'];
        }

        $device->forceFill(['blocked' => true, 'trusted' => false])->saveQuietly();
        DeviceSessionRevoker::forgetBlockedCache((int) $user->id, (string) ($device->fingerprint ?? ''));
        DeviceSessionRevoker::revokeDeviceSessions($user, $device);

        return ['ok' => true, 'message' => 'Забанено: '.$device->label().'. Войти с него больше нельзя'];
    }

    /**
     * Разблокировать устройство (сеанс сам не вернётся — нужен новый вход).
     *
     * @param User $user владелец
     * @param int $deviceId id устройства
     * @return array{ok:bool, message:string}
     */
    public static function unban(User $user, int $deviceId): array
    {
        $device = self::owned($user, $deviceId);

        if ($device === null) {
            return ['ok' => false, 'message' => 'Устройство не найдено'];
        }

        $device->forceFill(['blocked' => false])->saveQuietly();
        DeviceSessionRevoker::forgetBlockedCache((int) $user->id, (string) ($device->fingerprint ?? ''));

        return ['ok' => true, 'message' => 'Разблокировано: '.$device->label()];
    }

    /**
     * Подтвердить устройство («это я»).
     *
     * @param User $user владелец
     * @param int $deviceId id устройства
     * @return array{ok:bool, message:string}
     */
    public static function trust(User $user, int $deviceId): array
    {
        $device = self::owned($user, $deviceId);

        if ($device === null) {
            return ['ok' => false, 'message' => 'Устройство не найдено'];
        }

        $device->forceFill(['trusted' => true, 'blocked' => false])->saveQuietly();

        return ['ok' => true, 'message' => 'Подтверждено: '.$device->label()];
    }

    /**
     * Завершить все сеансы с живой строкой sessions.
     *
     * В боте нет понятия «текущий» (вне web-сессии), поэтому гасим все:
     * сам Telegram-чат при этом не страдает — это только web-сессии.
     *
     * @param User $user владелец
     * @return array{ok:bool, message:string, closed:int}
     */
    public static function terminateAll(User $user): array
    {
        $userId = (int) $user->id;

        $sessionIds = UserDevice::where('user_id', $userId)
            ->whereNotNull('session_id')
            ->pluck('session_id')
            ->map(fn ($id): string => (string) $id)
            ->filter()
            ->values()
            ->all();

        $alive = [];

        if ($sessionIds !== []) {
            $alive = DB::table('sessions')
                ->where('user_id', $userId)
                ->whereIn('id', $sessionIds)
                ->pluck('id')
                ->map(fn ($id): string => (string) $id)
                ->all();
        }

        $orphans = DB::table('sessions')
            ->where('user_id', $userId)
            ->when($sessionIds !== [], fn ($query) => $query->whereNotIn('id', $sessionIds))
            ->pluck('id')
            ->map(fn ($id): string => (string) $id)
            ->all();

        $all = array_values(array_unique([...$alive, ...$orphans]));

        if ($all === []) {
            return ['ok' => true, 'message' => 'Активных сеансов нет', 'closed' => 0];
        }

        DB::table('sessions')->whereIn('id', $all)->delete();

        try {
            broadcast(new SessionRevoked($userId, $all));
        } catch (\Throwable) {
            // No-op: строки уже удалены, поллер добьёт 401.
        }

        return ['ok' => true, 'message' => 'Закрыто сеансов: '.count($all), 'closed' => count($all)];
    }

    /**
     * Завершить сиротскую web-сессию без устройства.
     *
     * @param User $user владелец
     * @param string $sessionId id строки sessions
     * @return array{ok:bool, message:string}
     */
    public static function killOrphan(User $user, string $sessionId): array
    {
        $clean = trim($sessionId);

        if ($clean === '' || mb_strlen($clean) > 128) {
            return ['ok' => false, 'message' => 'Неверный сеанс'];
        }

        $deleted = DB::table('sessions')
            ->where('id', $clean)
            ->where('user_id', (int) $user->id)
            ->delete();

        if ($deleted === 0) {
            return ['ok' => true, 'message' => 'Сеанс уже закрыт'];
        }

        try {
            broadcast(new SessionRevoked((int) $user->id, [$clean]));
        } catch (\Throwable) {
            // No-op: строка уже удалена, поллер добьёт 401.
        }

        return ['ok' => true, 'message' => 'Сеанс завершён'];
    }

    /**
     * Устройство строго текущего владельца.
     *
     * @param User $user владелец
     * @param int $deviceId id устройства
     * @return UserDevice|null
     */
    private static function owned(User $user, int $deviceId): ?UserDevice
    {
        if ($deviceId <= 0) {
            return null;
        }

        return UserDevice::where('id', $deviceId)
            ->where('user_id', (int) $user->id)
            ->first();
    }
}
