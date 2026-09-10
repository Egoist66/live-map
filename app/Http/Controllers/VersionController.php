<?php

namespace App\Http\Controllers;

use App\Services\AppVersionService;
use Illuminate\Http\JsonResponse;

/**
 * Публичная версия билда для проверки обновлений на клиенте.
 */
class VersionController extends Controller
{
    /**
     * Вернуть текущую версию и время сборки.
     *
     * @return JsonResponse
     */
    public function show(): JsonResponse
    {
        return response()->json([
            'version' => AppVersionService::version(),
            'builtAt' => AppVersionService::builtAt(),
        ]);
    }
}
