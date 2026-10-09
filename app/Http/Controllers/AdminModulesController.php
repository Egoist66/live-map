<?php

namespace App\Http\Controllers;

use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminModulesController extends Controller
{
    /**
     * Глобальные модули приложения для админки.
     *
     * ULove включён всегда. Остальные разделы администратор включает
     * глобально — только после этого пользователи видят их тумблеры
     * в настройках «Приложение» и могут включать у себя.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(): JsonResponse
    {
        return response()->json([
            'global_modules' => AppSettings::globalModules(),
            'all_modules' => ['ulove', 'upin', 'uflow', 'districts', 'business'],
        ]);
    }

    /**
     * Сохранить глобальный набор модулей (только полные админы).
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'modules' => ['required', 'array', 'min:1'],
            'modules.*' => ['required', 'string', 'in:ulove,upin,uflow,districts,business'],
        ]);

        $modules = array_values(array_unique(array_map('strval', $data['modules'])));
        $next = AppSettings::setGlobalModules($modules);

        return response()->json([
            'global_modules' => $next,
        ]);
    }
}
