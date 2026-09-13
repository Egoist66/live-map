<?php

namespace App\Http\Controllers;

use App\Services\QuestService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Задания для PRO-недели: треки пинов и свайпов.
 */
class QuestController extends Controller
{
    /**
     * Состояние заданий, рейтинга и PRO.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $state = QuestService::state($request->user());

        return response()->json($state);
    }

    /**
     * Пересчитать прогресс (после действий пользователя).
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function refresh(Request $request): JsonResponse
    {
        $state = QuestService::state($request->user());

        return response()->json($state);
    }

    /**
     * Забрать PRO-неделю за полностью закрытый трек.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function claim(Request $request): JsonResponse
    {
        $data = $request->validate([
            'track' => ['required', 'string', 'in:pins,swipes'],
        ]);

        $result = QuestService::claim($request->user(), $data['track']);

        return response()->json($result, 201);
    }
}
