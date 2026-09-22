<?php

namespace App\Http\Controllers;

use App\Models\VideoCall;
use App\Services\TurnService;
use App\Services\VideoService;
use Illuminate\Http\Request;

/**
 * Видеозвонки: мэтч-звонки и рулетка поверх WebRTC P2P.
 *
 * Тонкий контроллер: вся механика (мэтч-проверки, очередь, таймауты,
 * broadcast + персистентность сигналов) — в VideoService.
 */
class VideoController extends Controller
{
    public function __construct(private VideoService $video, private TurnService $turn) {}

    /**
     * ICE-конфиг для WebRTC: STUN всегда + TURN когда настроен.
     *
     * Фронт запрашивает перед созданием RTCPeerConnection и кэширует
     * на ttl ответа. Флаг turnConfigured=false — звонки за симметричным
     * NAT не встанут, клиент показывает предупреждение.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function iceServers(Request $request)
    {
        $config = $this->turn->iceConfig((int) $request->user()->id);

        if ($request->user()->isAdmin()) {
            $config['debug'] = array_merge(
                $this->turn->debugSources(),
                ['servers_count' => count($config['iceServers'] ?? [])]
            );
        }

        return response()->json($config);
    }

    /**
     * Позвонить напрямую: мэтчу или другу.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function callMatch(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|integer|min:1|exists:users,id',
        ]);

        $call = $this->video->startMatchCall($request->user(), (int) $data['user_id']);

        return response()->json([
            'call' => $this->video->toPayload($call, (int) $request->user()->id),
        ], 201);
    }

    /**
     * Принять входящий звонок.
     *
     * @param Request $request
     * @param VideoCall $call
     * @return \Illuminate\Http\JsonResponse
     */
    public function accept(Request $request, VideoCall $call)
    {
        $call = $this->video->accept($request->user(), $call);

        return response()->json([
            'call' => $this->video->toPayload($call, (int) $request->user()->id),
        ]);
    }

    /**
     * Отклонить входящий звонок.
     *
     * @param Request $request
     * @param VideoCall $call
     * @return \Illuminate\Http\JsonResponse
     */
    public function decline(Request $request, VideoCall $call)
    {
        $call = $this->video->decline($request->user(), $call);

        return response()->json([
            'call' => $this->video->toPayload($call, (int) $request->user()->id),
        ]);
    }

    /**
     * Положить трубку.
     *
     * @param Request $request
     * @param VideoCall $call
     * @return \Illuminate\Http\JsonResponse
     */
    public function hangup(Request $request, VideoCall $call)
    {
        $call = $this->video->hangup($request->user(), $call);

        return response()->json([
            'call' => $this->video->toPayload($call, (int) $request->user()->id),
        ]);
    }

    /**
     * переслать signaling-фрейм (offer/answer/ice), сообщение чата звонка
     * или приглашение в приватный чат.
     *
     * Чат звонка едет тем же транспортом (broadcast + таблица для polling),
     * отдельным видом фрейма kind=chat с текстом до 500 символов.
     * Приглашение в приват — kind=private_invite c id созданного диалога,
     * второй участник видит баннер «перейти в чат» даже после отбоя.
     * Сигналинг идёт отдельным ведром throttle:video-signal (300/мин):
     * делить корзину с typing/read нельзя — иначе offer тонет в 429
     * и звонок навсегда остаётся чёрным с «Соединение…».
     *
     * @param Request $request
     * @param VideoCall $call
     * @return \Illuminate\Http\JsonResponse
     */
    public function signal(Request $request, VideoCall $call)
    {
        $data = $request->validate([
            'kind' => 'required|in:offer,answer,ice,chat,private_invite',
            'payload' => 'nullable|array',
        ]);

        $payload = $data['payload'] ?? null;

        if ($data['kind'] === 'chat') {
            $text = trim((string) ($payload['text'] ?? ''));
            abort_if($text === '', 422, 'Пустое сообщение');
            abort_if(mb_strlen($text) > 500, 422, 'Сообщение до 500 символов');
            $payload = ['text' => $text];
        }

        if ($data['kind'] === 'private_invite') {
            $conversationId = (int) ($payload['conversation_id'] ?? 0);
            abort_if($conversationId < 1, 422, 'Нет id диалога');
            $payload = ['conversation_id' => $conversationId];
        }

        $signal = $this->video->signal($request->user(), $call, $data['kind'], $payload);

        return response()->json([
            'id' => (int) $signal->id,
            'call_id' => (int) $call->id,
            'kind' => (string) $signal->kind,
        ], 201);
    }

    /**
     * Сигналы звонка курсором (добивка при мёртвом realtime).
     *
     * @param Request $request
     * @param VideoCall $call
     * @return \Illuminate\Http\JsonResponse
     */
    public function signals(Request $request, VideoCall $call)
    {
        $data = $request->validate([
            'after_id' => 'nullable|integer|min:0',
        ]);

        return response()->json([
            'signals' => $this->video->callSignals($call, (int) $request->user()->id, (int) ($data['after_id'] ?? 0)),
        ]);
    }

    /**
     * Показать звонок (перечитать статус для polling-синка).
     *
     * @param Request $request
     * @param VideoCall $call
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request, VideoCall $call)
    {
        abort_unless($call->involves((int) $request->user()->id), 403, 'Чужой звонок');

        return response()->json([
            'call' => $this->video->toPayload($call->refresh(), (int) $request->user()->id),
        ]);
    }

    /**
     * Висящие входящие звонки (добивка при мёртвом realtime).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function pending(Request $request)
    {
        return response()->json([
            'incoming' => $this->video->pendingIncoming($request->user()),
        ]);
    }

    /**
     * Сколько людей сейчас в очереди рулетки (живые места).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function rouletteStats(Request $request)
    {
        return response()->json([
            'waiting' => $this->video->queueCount(),
        ]);
    }

    /**
     * Встать в очередь рулетки.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function rouletteJoin(Request $request)
    {
        $data = $request->validate([
            'gender' => 'nullable|in:male,female,all',
        ]);

        $result = $this->video->joinRoulette($request->user(), $data);
        $call = $result['call'];

        return response()->json([
            'matched' => (bool) $result['matched'],
            'call' => $call ? $this->video->toPayload($call, (int) $request->user()->id) : null,
        ]);
    }

    /**
     * «Дальше»: завершить текущий и искать следующего.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function rouletteNext(Request $request)
    {
        $data = $request->validate([
            'call_id' => 'nullable|integer|min:1',
            'gender' => 'nullable|in:male,female,all',
        ]);

        $call = null;

        if (! empty($data['call_id'])) {
            $call = VideoCall::find($data['call_id']);

            if ($call) {
                abort_unless($call->involves((int) $request->user()->id), 403, 'Чужой звонок');
            }
        }

        $result = $this->video->nextRoulette($request->user(), $call);
        $next = $result['call'];

        return response()->json([
            'matched' => (bool) $result['matched'],
            'call' => $next ? $this->video->toPayload($next, (int) $request->user()->id) : null,
        ]);
    }

    /**
     * Покинуть очередь рулетки.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function rouletteLeave(Request $request)
    {
        $this->video->leaveQueue((int) $request->user()->id);

        return response()->json(['ok' => true]);
    }
}
