<?php

namespace App\Http\Controllers;

use App\Services\AppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Глобальный тумблер ИИ-функционала (только полные админы).
 *
 * Пока выключен — обычные пользователи не видят ничего ИИшного
 * (гид, AI-анкета, разбор профиля): фронт прячет кнопки по
 * shared-пропсу `aiEnabled`, бэкенд режет API гейтом 403.
 * Staff видит ИИ всегда, чтобы тестировать без палева.
 */
class AdminAiController extends Controller
{
    /**
     * Текущее состояние тумблера ИИ для админки.
     *
     * @return JsonResponse { enabled: bool }
     */
    public function show(): JsonResponse
    {
        return response()->json([
            'enabled' => AppSettings::isAiEnabled(),
        ]);
    }

    /**
     * Включить или выключить ИИ глобально.
     *
     * @param Request $request запрос с флагом enabled
     * @return JsonResponse новое состояние { enabled: bool }
     */
    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $enabled = AppSettings::setAiEnabled((bool) $data['enabled']);

        return response()->json([
            'enabled' => $enabled,
        ]);
    }
}
