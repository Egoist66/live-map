<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Services\SosService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * SOS-вызовы: принятие, отклонение, активный режим, закрытие.
 */
class SosController extends Controller
{
    /**
     * Активный SOS пользователя и лимиты месяца.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();
        $call = SosService::activeFor($user);

        return response()->json([
            'sos' => $call ? $this->callPayload($call, $user->id) : null,
            'limits' => SosService::limits($user),
        ]);
    }

    /**
     * Состояние SOS для пина.
     *
     * @param Request $request
     * @param Pin $pin
     * @return JsonResponse
     */
    public function show(Request $request, Pin $pin): JsonResponse
    {
        abort_unless(\App\Models\Pin::isSosCategory($pin->category), 422, 'Это не SOS-пин.');

        $user = $request->user();
        $call = SosService::callFor($pin);
        $declined = $call->declines()->where('user_id', $user->id)->exists();

        return response()->json([
            'sos' => $this->callPayload($call, $user->id),
            'declined_by_me' => $declined,
            'is_creator' => (int) $pin->user_id === (int) $user->id,
        ]);
    }

    /**
     * Принять SOS и получить отдельный чат.
     *
     * @param Request $request
     * @param Pin $pin
     * @return JsonResponse
     */
    public function accept(Request $request, Pin $pin): JsonResponse
    {
        $call = SosService::accept($request->user(), $pin);

        return response()->json([
            'sos' => $this->callPayload($call, $request->user()->id),
        ], 201);
    }

    /**
     * Отклонить SOS.
     *
     * @param Request $request
     * @param Pin $pin
     * @return JsonResponse
     */
    public function decline(Request $request, Pin $pin): JsonResponse
    {
        SosService::decline($request->user(), $pin);

        return response()->json(['ok' => true]);
    }

    /**
     * Завершить SOS: архив чата обоим, удаление чата, удаление пина.
     *
     * @param Request $request
     * @param Pin $pin
     * @return JsonResponse
     */
    public function close(Request $request, Pin $pin): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || (int) $pin->user_id === (int) $user->id, 403, 'Завершить SOS может только создатель.');

        try {
            SosService::cleanupConversationForPin($pin, 'closed');
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('sos cleanup failed: '.$e->getMessage());
        }

        return app(PinController::class)->destroy($pin);
    }

    /**
     * Пейлоад вызова для фронта.
     *
     * @param \App\Models\SosCall $call
     * @param int $viewerId
     * @return array
     */
    protected function callPayload(\App\Models\SosCall $call, int $viewerId): array
    {
        $call->loadMissing(['pin', 'responder:id,name,profile_slug,avatar_path', 'creator:id,name,profile_slug,avatar_path']);

        $pin = $call->pin;

        return [
            'id' => $call->id,
            'status' => $call->status,
            'is_participant' => $call->isParticipant($viewerId),
            'is_creator' => (int) $call->creator_id === $viewerId,
            'responder' => $call->responder ? array_merge(
                $call->responder->only(['id', 'name', 'profile_slug', 'avatar_path']),
                ['avatar_url' => $call->responder->avatar_url]
            ) : null,
            'conversation_id' => $call->conversation_id,
            'pin' => $pin ? $pin->toPublicArray($viewerId) : null,
        ];
    }
}
