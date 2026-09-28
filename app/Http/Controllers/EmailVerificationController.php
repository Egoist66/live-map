<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Статус подтверждения почты и повторная отправка ссылки (JSON API).
 *
 * Использует фронтовый баннер «Подтвердите почту»: статус — для
 * начального состояния и опроса, отправка — для кнопки «Отправить заново».
 */
class EmailVerificationController extends Controller
{
    /**
     * Текущий статус верификации почты пользователя.
     *
     * @param Request $request запрос
     * @return JsonResponse verified, email, verified_at
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'verified' => $user->hasVerifiedEmail(),
            'email' => $user->email,
            'verified_at' => $user->email_verified_at?->toISOString(),
        ]);
    }

    /**
     * Отправить ссылку подтверждения повторно.
     *
     * Уже подтверждённым отвечает verified:true без отправки.
     *
     * @param Request $request запрос
     * @return JsonResponse status verification-link-sent либо verified:true
     */
    public function send(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json(['verified' => true]);
        }

        $user->sendEmailVerificationNotification();

        return response()->json(['status' => 'verification-link-sent']);
    }
}
