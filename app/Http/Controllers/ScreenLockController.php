<?php

namespace App\Http\Controllers;

use App\Services\ScreenLockResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Тонкий контроллер скринлокера: флаг активности и сброс забытого кода.
 *
 * Код блокировки по-прежнему не покидает устройство. Сервер хранит лишь
 * `is_sl_active` (для меню Telegram-бота) и метку сброса, а вся логика
 * кодов, лимитов и рассылки живёт в ScreenLockResetService.
 */
class ScreenLockController extends Controller
{
    /**
     * Сообщить, включён ли скринлокер на этом устройстве.
     *
     * @param Request $request запрос с полем `active`
     * @return JsonResponse
     */
    public function active(Request $request): JsonResponse
    {
        $data = $request->validate([
            'active' => 'required|boolean',
        ]);

        ScreenLockResetService::setActive($request->user(), (bool) $data['active']);

        return response()->json(['ok' => true]);
    }

    /**
     * Отправить код сброса на почту аккаунта.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function code(Request $request): JsonResponse
    {
        $result = ScreenLockResetService::issueCode($request->user());

        $status = $result['ok'] ? 200 : ($result['retry_after'] > 0 ? 429 : 422);

        return response()->json([
            'ok' => $result['ok'],
            'message' => $result['message'],
            'retry_after' => $result['retry_after'],
        ], $status);
    }

    /**
     * Проверить код из письма и сбросить локер.
     *
     * @param Request $request запрос с полем `code`
     * @return JsonResponse
     */
    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => 'required|digits:6',
        ]);

        $result = ScreenLockResetService::verifyCode($request->user(), (string) $data['code']);

        return response()->json([
            'ok' => $result['ok'],
            'message' => $result['message'],
            'reset_at' => $result['reset_at'],
        ], $result['ok'] ? 200 : 422);
    }
}
