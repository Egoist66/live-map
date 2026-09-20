<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/**
 * Подписки PRO/Business: статус, продление на месяц, отказ.
 *
 * Платный тариф действует PERIOD_DAYS дней. За RENEWAL_WINDOW_DAYS
 * дней до конца (и в грейс-период после) фронт показывает окно
 * продления: «Продлить» сдвигает срок на месяц вперёд,
 * «Отказаться» сразу откатывает на free.
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
     * Продлить подписку на месяц вперёд.
     *
     * База — будущий срок того же тарифа, иначе «сейчас»:
     * досрочное продление не съедает оплаченные дни.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function renew(Request $request)
    {
        $data = $request->validate([
            'plan' => 'required|in:pro,business',
        ]);

        $me = $request->user();
        $plan = $data['plan'];

        $base = now();
        try {
            $currentExpiry = $me->plan_expires_at ? \Carbon\Carbon::parse($me->plan_expires_at) : null;
        } catch (\Throwable) {
            $currentExpiry = null;
        }

        if ($me->plan === $plan && $currentExpiry && $currentExpiry->isFuture()) {
            $base = $currentExpiry;
        }

        $me->forceFill([
            'plan' => $plan,
            'plan_expires_at' => $base->copy()->addDays(self::PERIOD_DAYS),
        ])->save();

        return response()->json($this->state($me->refresh()));
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

        if ($plan !== 'pro' && $plan !== 'business') {
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
