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
     * Ответ никогда не кэшируется: stale-версия из HTTP-кэша после
     * деплоя давала вечный mismatch с `appVersion` из HTML и баннер
     * «Вышло обновление» показывался бесконечно после нажатия «Обновить».
     *
     * @return JsonResponse
     */
    public function show(): JsonResponse
    {
        return response()->json([
            'version' => AppVersionService::version(),
            'builtAt' => AppVersionService::builtAt(),
        ])->header('Cache-Control', 'no-store, no-cache, must-revalidate')
            ->header('Pragma', 'no-cache');
    }
}
