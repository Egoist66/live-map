<?php

namespace App\Http\Controllers;

use App\Models\UserDevice;
use App\Services\DeviceSessionRevoker;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Доверенные устройства пользователя: подтвердить, завершить сеанс,
 * заблокировать навсегда (таб «Безопасность» → «Сеансы»).
 *
 * Завершение удаляет web-сеансы устройства (привязанный +
 * все сиротские владельца — чужак сидит через непривязанную)
 * вместе со строкой устройства и шлёт SessionRevoked
 * в личный канал — жертва вылетает мгновенно, а не на
 * следующем запросе. Та же механика, что в боте.
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
     * Строку устройства удаляем — та же механика, что у кнопки
     * «Завершить» в боте: иначе она вечно висит в списке
     * со stale session_id. Сессии (привязанная + сиротские)
     * гасит DeviceSessionRevoker.
     *
     * @param Request $request текущий запрос
     * @param int $device id устройства
     * @return \Illuminate\Http\JsonResponse
     */
    public function terminate(Request $request, int $device)
    {
        $row = $this->owned($request, $device);
        $killed = DeviceSessionRevoker::revokeDeviceSessions($request->user(), $row);
        $row->delete();

        return response()->json(['ok' => true, 'revoked' => $killed !== []]);
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
        DeviceSessionRevoker::forgetBlockedCache((int) $row->user_id, (string) ($row->fingerprint ?? ''));
        $killed = DeviceSessionRevoker::revokeDeviceSessions($request->user(), $row);

        return response()->json(['ok' => true, 'revoked' => $killed !== []]);
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
        DeviceSessionRevoker::forgetBlockedCache((int) $row->user_id, (string) ($row->fingerprint ?? ''));

        return response()->json(['ok' => true]);
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
