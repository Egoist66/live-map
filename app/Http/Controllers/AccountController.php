<?php

namespace App\Http\Controllers;

use App\Services\AccountDeletionService;
use App\Services\ProfileVisibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Видимость анкеты и отложенное удаление профиля.
 *
 * - GET /api/account/status — скрыта ли анкета, висит ли удаление, дни до сноса, PRO-подарок;
 * - POST /api/account/hide + /show — скрыть/вернуть анкету;
 * - POST /api/account/deletion + DELETE — запросить/отменить удаление (grace 14 дней).
 */
class AccountController extends Controller
{
    /**
     * Статус анкеты: видимость + удаление + тариф.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(self::shape($user));
    }

    /**
     * Скрыть анкету: никто не видит, возврат одним тапом.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse
     */
    public function hide(Request $request): JsonResponse
    {
        $user = ProfileVisibilityService::hide($request->user());

        return response()->json(self::shape($user));
    }

    /**
     * Вернуть анкету в поиск и ленту.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse
     */
    public function show(Request $request): JsonResponse
    {
        $user = ProfileVisibilityService::show($request->user());

        return response()->json(self::shape($user));
    }

    /**
     * Запросить удаление: прячем всё, дарим неделю PRO, снос через 14 дней.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse
     */
    public function requestDeletion(Request $request): JsonResponse
    {
        $user = AccountDeletionService::request($request->user());

        return response()->json(self::shape($user));
    }

    /**
     * Отменить удаление: всё возвращается как было, PRO-подарок остаётся.
     *
     * @param Request $request текущий запрос
     * @return JsonResponse
     */
    public function cancelDeletion(Request $request): JsonResponse
    {
        $user = AccountDeletionService::cancel($request->user());

        return response()->json(self::shape($user));
    }

    /**
     * Единая форма статуса для фронта и бота.
     *
     * @param \App\Models\User $user владелец
     * @return array<string, mixed>
     */
    public static function shape(\App\Models\User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $scheduled = null;

        try {
            $scheduled = $fresh->deletion_scheduled_at?->toISOString();
        } catch (\Throwable) {
            $scheduled = null;
        }

        $proUntil = null;

        try {
            $proUntil = $fresh->deletion_pro_until?->toISOString();
        } catch (\Throwable) {
            $proUntil = null;
        }

        return [
            'hidden' => $fresh->isProfileHidden(),
            'pending_deletion' => $fresh->isPendingDeletion(),
            'days_left' => $fresh->deletionDaysLeft(),
            'deletion_scheduled_at' => $scheduled,
            'deletion_pro_until' => $proUntil,
            'plan' => $fresh->plan ?? 'free',
            'effective_plan' => $fresh->effectivePlan(),
            'dating_enabled' => (bool) ($fresh->dating_enabled ?? true),
        ];
    }
}
