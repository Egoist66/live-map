<?php

namespace App\Http\Controllers;

use App\Events\SessionRevoked;
use App\Models\UserDevice;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Доверенные устройства пользователя: подтвердить, завершить сеанс,
 * заблокировать навсегда (таб «Безопасность» → «Сеансы»).
 *
 * Завершение и блокировка сразу удаляют web-сеанс устройства
 * и шлют SessionRevoked в личный канал — жертва вылетает мгновенно,
 * а не на следующем запросе.
 */
class DeviceController extends Controller
{
    /**
     * Список устройств пользователя, свежие сверху.
     *
     * @param Request $request текущий запрос
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $userId = (int) $request->user()->id;
        $currentId = (string) $request->session()->getId();

        $devices = UserDevice::where('user_id', $userId)
            ->orderByDesc('last_seen_at')
            ->limit(50)
            ->get();

        $sessionIds = $devices
            ->map(fn ($d) => (string) ($d->session_id ?? ''))
            ->filter()
            ->values()
            ->all();

        $alive = [];

        if ($sessionIds !== []) {
            $alive = DB::table('sessions')
                ->whereIn('id', $sessionIds)
                ->pluck('id')
                ->map(fn ($id) => (string) $id)
                ->all();
        }

        $list = $devices->map(fn ($d) => [
            'id' => $d->id,
            'label' => $d->label(),
            'device' => $d->device,
            'platform' => $d->platform,
            'browser' => $d->browser,
            'client' => $d->client,
            'ip' => $d->ip,
            'country' => $d->country,
            'city' => $d->city,
            'trusted' => (bool) $d->trusted,
            'blocked' => (bool) $d->blocked,
            'has_session' => $d->session_id !== null && in_array((string) $d->session_id, $alive, true),
            'is_current' => $d->session_id !== null && (string) $d->session_id === $currentId,
            'first_seen_at' => $d->first_seen_at?->toISOString(),
            'last_seen_at' => $d->last_seen_at?->toISOString(),
        ]);

        return response()->json(['data' => $list]);
    }

    /**
     * Подтвердить устройство («это я»): больше не подозрительное.
     *
     * @param Request $request текущий запрос
     * @param UserDevice $device устройство (scoped ниже вручную)
     * @return \Illuminate\Http\JsonResponse
     */
    public function trust(Request $request, int $device)
    {
        $row = $this->owned($request, $device);
        $row->forceFill(['trusted' => true, 'blocked' => false])->saveQuietly();

        return response()->json(['ok' => true]);
    }

    /**
     * Завершить сеанс устройства без блокировки.
     *
     * @param Request $request текущий запрос
     * @param int $device id устройства
     * @return \Illuminate\Http\JsonResponse
     */
    public function terminate(Request $request, int $device)
    {
        $row = $this->owned($request, $device);
        $revoked = $this->killSession($row);

        return response()->json(['ok' => true, 'revoked' => $revoked]);
    }

    /**
     * Заблокировать устройство навсегда + завершить его сеанс.
     *
     * @param Request $request текущий запрос
     * @param int $device id устройства
     * @return \Illuminate\Http\JsonResponse
     */
    public function block(Request $request, int $device)
    {
        $row = $this->owned($request, $device);
        $row->forceFill(['blocked' => true, 'trusted' => false])->saveQuietly();
        $revoked = $this->killSession($row);

        return response()->json(['ok' => true, 'revoked' => $revoked]);
    }

    /**
     * Разблокировать устройство (снова потребует подтверждения при входе — нет:
     * отпечаток уже известен, строка остаётся недоверенной до кнопки «Это я»).
     *
     * @param Request $request текущий запрос
     * @param int $device id устройства
     * @return \Illuminate\Http\JsonResponse
     */
    public function unblock(Request $request, int $device)
    {
        $row = $this->owned($request, $device);
        $row->forceFill(['blocked' => false])->saveQuietly();

        return response()->json(['ok' => true]);
    }

    /**
     * Удалить web-сеанс устройства и пнуть его по realtime.
     *
     * @param UserDevice $row устройство
     * @return bool true когда строка сессии реально удалена
     */
    private function killSession(UserDevice $row): bool
    {
        $sessionId = (string) ($row->session_id ?? '');

        if ($sessionId === '') {
            return false;
        }

        $deleted = DB::table('sessions')
            ->where('id', $sessionId)
            ->where('user_id', $row->user_id)
            ->delete();

        if ($deleted > 0) {
            try {
                broadcast(new SessionRevoked((int) $row->user_id, [$sessionId]));
            } catch (\Throwable) {
                // No-op: строка уже удалена, поллер добьёт 401.
            }

            return true;
        }

        return false;
    }

    /**
     * Строка устройства строго текущего пользователя.
     *
     * @param Request $request текущий запрос
     * @param int $device id устройства
     * @return UserDevice
     */
    private function owned(Request $request, int $device): UserDevice
    {
        $row = UserDevice::where('id', $device)
            ->where('user_id', (int) $request->user()->id)
            ->first();

        abort_if($row === null, 404, 'Устройство не найдено');

        return $row;
    }
}
