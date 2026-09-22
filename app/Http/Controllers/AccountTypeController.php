<?php

namespace App\Http\Controllers;

use App\Http\Requests\AccountTypeRequest;
use Illuminate\Http\JsonResponse;

/**
 * Переключение персона ↔ компания.
 *
 * business сразу ведёт в кабинет (/business),
 * person — в обычный лендинг по default_mode.
 */
class AccountTypeController extends Controller
{
    /**
     * Сохранить тип аккаунта.
     */
    public function update(AccountTypeRequest $request): JsonResponse
    {
        $user = $request->user();

        $type = $request->validated()['account_type'];

        $user->forceFill(['account_type' => $type])->save();

        if ($type === 'business') {
            app(\App\Services\BusinessService::class)->profileFor($user->fresh());
        }

        $fresh = $user->fresh();

        return response()->json([
            'account_type' => $fresh->account_type,
            'landing' => $fresh->landingPath(),
        ]);
    }
}
