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
     * Отдаём честный статус всем: модалку стаффу скрывает фронт
     * (useEmailVerification.isStaff), а карточка в разделе
     * «Безопасность» показывает реальное состояние и позволяет
     * подтвердить почту вручную.
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
     * Отправка только по явной кнопке — при регистрации письмо
     * автоматически не уходит.
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
