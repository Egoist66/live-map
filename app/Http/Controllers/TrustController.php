<?php

namespace App\Http\Controllers;

use App\Services\TrustScoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Репутация текущего пользователя: траст-скор 1–10 и его зона.
 */
class TrustController extends Controller
{
    /**
     * Своя репутация: скор, подпись зоны и расшифровка.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json(TrustScoreService::state($request->user()));
    }
}
