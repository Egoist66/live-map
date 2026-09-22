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

        $patch = ['account_type' => $type];

        if ($type === 'business') {
            if (($user->role ?? 'user') === 'user') {
                $patch['role'] = 'organization';
            }

            if (($user->plan ?? 'free') !== 'business') {
                $patch['plan'] = 'business';
                $patch['plan_expires_at'] = now()->addDays(30);
            } elseif ($user->plan_expires_at === null) {
                $patch['plan_expires_at'] = now()->addDays(30);
            }
        }

        $user->forceFill($patch)->save();

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
