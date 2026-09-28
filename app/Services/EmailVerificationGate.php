<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Exceptions\HttpResponseException;

/**
 * Гейт действий по подтверждённой почте.
 *
 * Без верификации запрещены лайки/суперлайки в свайпах и отправка
 * сообщений: доступны только просмотр ленты, избранное и чтение.
 * Стафф (админы и модераторы) от гейта освобождён.
 */
class EmailVerificationGate
{
    /**
     * Текст отказа для лайков в свайпах.
     */
    public const MESSAGE_LIKE = 'Лайки доступны после подтверждения почты. Проверьте письмо со ссылкой — без неё работает только избранное.';

    /**
     * Текст отказа для отправки сообщений.
     */
    public const MESSAGE_WRITE = 'Сообщения доступны после подтверждения почты. Проверьте письмо со ссылкой.';

    /**
     * Проверить, что пользователь может лайкать в свайпах.
     *
     * @param User $user автор лайка
     * @return void
     *
     * @throws HttpResponseException 403 с флагом email_unverified
     */
    public static function assertCanLike(User $user): void
    {
        $reason = $user->emailGateReason();

        if ($reason === null) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => self::MESSAGE_LIKE,
            'email_unverified' => true,
        ], 403));
    }

    /**
     * Проверить, что пользователь может отправлять сообщения.
     *
     * @param User $user автор сообщения
     * @return void
     *
     * @throws HttpResponseException 403 с флагом email_unverified
     */
    public static function assertCanWrite(User $user): void
    {
        $reason = $user->emailGateReason();

        if ($reason === null) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => self::MESSAGE_WRITE,
            'email_unverified' => true,
        ], 403));
    }
}
