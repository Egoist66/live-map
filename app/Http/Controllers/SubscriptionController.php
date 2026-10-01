<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/**
 * Подписки PRO/Premium/Business: статус, продление на месяц, отказ.
 *
 * Платный тариф действует PERIOD_DAYS дней. За RENEWAL_WINDOW_DAYS
 * дней до конца (и в грейс-период после) фронт показывает окно
 * продления: «Продлить» сдвигает срок на месяц вперёд,
 * «Отказаться» сразу откатывает на free.
 *
 * Важно: платные тарифы нельзя просто взять кнопкой — сначала оплата
 * (перевод на карту/счёт, шлюз в разработке). Поэтому renew() для
 * pro/premium/business отвечает 402 payment_required с заглушкой,
 * мгновенно переключается только откат на free. Подарочные выдачи
 * (удаление с PRO-приманкой, админ) идут мимо контроллера и работают.
 *
 * Premium — топ-тариф для стаффа (админ/модератор получают его
 * по умолчанию через effectivePlan), Business — только для
 * организаторов (кабинет компании).
 */
class SubscriptionController extends Controller
{
    /** Длительность подписки при выдаче и продлении, дней. */
    public const PERIOD_DAYS = 30;

    /** За сколько дней до конца показывать окно продления. */
    public const RENEWAL_WINDOW_DAYS = 3;

    /** Сколько дней после конца срока тариф ещё можно продлить. */
    public const GRACE_DAYS = 3;

    /**
     * Статус подписки текущего пользователя.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function status(Request $request)
    {
        return response()->json($this->state($request->user()));
    }

    /**
     * Текст-заглушка оплаты платных тарифов (шлюз в разработке).
     */
    public const PAYMENT_NOTE = 'Оплата в разработке: тарифы PRO/Premium подключаются после оплаты переводом на карту или счёт. Напишите в поддержку — после подтверждения оплаты тариф включат вручную.';

    /**
     * Продлить подписку на месяц вперёд.
     *
     * Платные тарифы кнопкой не выдаются: сначала оплата, поэтому
     * отвечаем 402 payment_required с заглушкой. Мгновенно работает
     * только откат на free через cancel().
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function renew(Request $request)
    {
        $data = $request->validate([
            'plan' => 'required|in:pro,premium,business',
        ]);

        $me = $request->user();
        $plan = $data['plan'];

        // Business — только для организаторов: персонам его не выдаём.
        if ($plan === 'business' && ! $me->isOrganization() && ! $me->isBusinessAccount()) {
            return response()->json(['message' => 'Тариф Business — только для организаторов (кабинет компании).'], 422);
        }

        return response()->json([
            'message' => self::PAYMENT_NOTE,
            'payment_required' => true,
            'plan' => $plan,
        ], 402);
    }

    /**
     * Отказаться от подписки: немедленный откат на free.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function cancel(Request $request)
    {
        $me = $request->user();
        $me->forceFill(['plan' => 'free', 'plan_expires_at' => null])->save();

        return response()->json($this->state($me->refresh()));
    }

    /**
     * Состояние подписки для фронта и окна продления.
     *
     * @param \App\Models\User $user
     * @return array{plan:string,expires_at:string|null,days_left:int|null,expired:bool,needs_renewal:bool}
     */
    private function state($user): array
    {
        $plan = $user->plan ?? 'free';

        if (! in_array($plan, ['pro', 'premium', 'business'], true)) {
            return [
                'plan' => 'free',
                'expires_at' => null,
                'days_left' => null,
                'expired' => false,
                'needs_renewal' => false,
            ];
        }

        try {
            $expires = $user->plan_expires_at ? \Carbon\Carbon::parse($user->plan_expires_at) : null;
        } catch (\Throwable) {
            $expires = null;
        }

        if (! $expires) {
            return [
                'plan' => $plan,
                'expires_at' => null,
                'days_left' => null,
                'expired' => false,
                'needs_renewal' => false,
            ];
        }

        $daysLeft = (int) ceil(($expires->timestamp - now()->timestamp) / 86400);
        $expired = $expires->isPast();

        return [
            'plan' => $plan,
            'expires_at' => $expires->toISOString(),
            'days_left' => $daysLeft,
            'expired' => $expired,
            'needs_renewal' => $daysLeft <= self::RENEWAL_WINDOW_DAYS,
        ];
    }
}
