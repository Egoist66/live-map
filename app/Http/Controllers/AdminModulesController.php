<?php

namespace App\Http\Controllers;

use App\Services\AppSettings;
use App\Services\ReleasedModulesActivator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminModulesController extends Controller
{
    /**
     * Глобальные модули приложения для админки.
     *
     * ULove включён всегда. Остальные разделы администратор включает
     * глобально — после этого они сразу активируются у пользователей
     * (тумблер в настройках «Приложение» уже включён, выключить
     * раздел обратно пользователь может сам).
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
     * Вновь включённые разделы не просто появляются тумблерами
     * в настройках, а сразу активируются у пользователей с явным
     * списком модулей (legacy-аккаунты видят всё новое сами).
     * Стартовый экран пользователей при этом не меняется.
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

        $previous = AppSettings::globalModules();
        $modules = array_values(array_unique(array_map('strval', $data['modules'])));
        $next = AppSettings::setGlobalModules($modules);

        $added = array_values(array_diff($next, $previous));
        $activated = ReleasedModulesActivator::activate($added);

        return response()->json([
            'global_modules' => $next,
            'activated_users' => $activated,
        ]);
    }
}
