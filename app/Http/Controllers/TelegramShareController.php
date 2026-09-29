<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Services\TelegramUsernameShare;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Обмен Telegram-username по обоюдному согласию в личных диалогах.
 *
 * Тонкий контроллер: вся механика (офферы, проверка взаимности,
 * рассылка через бота) — в TelegramUsernameShare. Юзернейм
 * собеседника отдаём только после состоявшегося обмена.
 */
class TelegramShareController extends Controller
{
    /**
     * Поделиться своим username (создать оффер).
     *
     * Второй оффер пары триггерит обмен: обоим в личку бота падает
     * @username собеседника. Если у кого-то нет username — 200
     * с error=no_username (офферы живут, можно повторить позже).
     *
     * @param Request $request текущий запрос
     * @param Conversation $conversation direct-диалог
     * @return JsonResponse статус обмена {mine, peer, exchanged, peer_username, error}
     */
    public function offer(Request $request, Conversation $conversation): JsonResponse
    {
        $result = TelegramUsernameShare::offer($conversation, $request->user());

        return response()->json($result);
    }

    /**
     * Отозвать своё намерение (до момента обмена).
     *
     * @param Request $request текущий запрос
     * @param Conversation $conversation direct-диалог
     * @return JsonResponse статус обмена
     */
    public function revoke(Request $request, Conversation $conversation): JsonResponse
    {
        $result = TelegramUsernameShare::revoke($conversation, $request->user());

        return response()->json($result);
    }
}
