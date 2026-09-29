<?php

namespace App\Http\Controllers;

use App\Services\DeviceFingerprint;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Активные web-сессии пользователя (таб «Безопасность» → «Сеансы»).
 *
 * Читаем таблицу sessions напрямую (SESSION_DRIVER=database):
 * user_id, ip_address, user_agent, last_activity. Завершение чужого
 * сеанса — удаление его строки, текущий трогать запрещено.
 */
class SessionController extends Controller
{
    /**
     * Список сеансов текущего пользователя, свежие сверху.
     *
     * Текущий сеанс всегда первый с `is_current: true`: если его строки
     * нет в таблице (вход по токену, WebView не сохранил куки, другой
     * драйвер) — синтезируем её из живого запроса, иначе «я зашёл»
     * не виден и счётчик активных врёт.
     *
     * @param Request $request текущий запрос
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $userId = (int) $request->user()->id;
        $currentId = (string) $request->session()->getId();

        $rows = DB::table('sessions')
            ->where('user_id', $userId)
            ->orderByDesc('last_activity')
            ->limit(50)
            ->get();

        $list = $rows->map(function ($row) use ($currentId) {
            $parsed = DeviceFingerprint::parseUserAgent((string) ($row->user_agent ?? ''));

            return [
                'id' => (string) $row->id,
                'ip' => $row->ip_address,
                'device' => $parsed['device'],
                'platform' => $parsed['platform'],
                'browser' => $parsed['browser'],
                'label' => DeviceFingerprint::label([
                    'platform' => $parsed['platform'],
                    'browser' => $parsed['browser'],
                    'client' => 'web',
                ]),
                'is_current' => ((string) $row->id === $currentId),
                'last_activity_at' => Carbon::createFromTimestamp((int) $row->last_activity)->toISOString(),
            ];
        });

        $hasCurrent = $list->contains(fn ($item) => $item['is_current']);

        if (! $hasCurrent) {
            $list->prepend($this->liveSession($request));
        }

        return response()->json(['data' => $list->values(), 'current_id' => $currentId]);
    }

    /**
     * Карточка живого сеанса из текущего запроса.
     *
     * Без гео (fingerprintOnly — без HTTP): подпись и иконка те же,
     * id `live` — в таблице такой строки нет, завершить нечего
     * (кнопки у текущего и так нет, destroy отдаст 404).
     *
     * @param Request $request текущий запрос
     * @return array{id:string,ip:string|null,device:string,platform:string,browser:string,label:string,is_current:true,last_activity_at:string}
     */
    private function liveSession(Request $request): array
    {
        $fp = DeviceFingerprint::fingerprintOnly($request);

        return [
            'id' => 'live',
            'ip' => $request->ip(),
            'device' => $fp['device'],
            'platform' => $fp['platform'],
            'browser' => $fp['browser'],
            'label' => DeviceFingerprint::label([
                'platform' => $fp['platform'],
                'browser' => $fp['browser'],
                'client' => $fp['client'],
            ]),
            'is_current' => true,
            'last_activity_at' => now()->toISOString(),
        ];
    }

    /**
     * Завершить чужой сеанс (удалить его строку).
     *
     * @param Request $request текущий запрос
     * @param string $id id строки sessions
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, string $id)
    {
        $userId = (int) $request->user()->id;
        $currentId = (string) $request->session()->getId();

        abort_if($id === $currentId, 422, 'Текущий сеанс завершить нельзя — выйдите обычным способом');

        $deleted = DB::table('sessions')
            ->where('id', $id)
            ->where('user_id', $userId)
            ->delete();

        abort_if($deleted === 0, 404, 'Сеанс не найден');

        try {
            broadcast(new SessionRevoked($userId, [$id]));
        } catch (\Throwable) {
            // No-op: строка уже удалена, поллер добьёт 401.
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Завершить все сеансы кроме текущего.
     *
     * @param Request $request текущий запрос
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroyOthers(Request $request)
    {
        $userId = (int) $request->user()->id;
        $currentId = (string) $request->session()->getId();

        $ids = DB::table('sessions')
            ->where('user_id', $userId)
            ->where('id', '!=', $currentId)
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();

        $deleted = 0;

        if ($ids !== []) {
            $deleted = DB::table('sessions')->whereIn('id', $ids)->delete();

            try {
                broadcast(new SessionRevoked($userId, $ids));
            } catch (\Throwable) {
                // No-op: строки уже удалены, поллер добьёт 401.
            }
        }

        return response()->json(['ok' => true, 'closed' => (int) $deleted]);
    }
}
