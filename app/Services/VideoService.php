<?php

namespace App\Services;

use App\Events\VideoIncoming;
use App\Events\VideoSignalEvent;
use App\Models\Conversation;
use App\Models\DatingMatch;
use App\Models\Friendship;
use App\Models\Message;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\VideoCall;
use App\Models\VideoSignal;
use Carbon\Carbon;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Голосовые звонки 1-1: мэтч-звонки и рулетка поверх WebRTC P2P (аудио).
 *
 * Сервер — только сигналинг и сведение пар: SDP/ICE идут через
 * broadcast (сокет) + таблицу video_signals (polling через sync()),
 * поэтому звонки работают при любом realtime-режиме.
 */
class VideoService
{
    /** Лимит рулетки для Free в сутки. PRO/админ — безлимит. */
    public const FREE_ROULETTE_PER_DAY = 5;

    /**
     * Кулдаун повторного дозвонка после отказа (отклонили / не взяли /
     * сбросили до ответа). Состоявшийся разговор под него не попадает.
     * По умолчанию выключен — работает только у тех, кто включил
     * «Защиту от дозвонов» в настройках (users.call_cooldown_enabled).
     */
    public const REDIAL_COOLDOWN_SEC = 300;

    /** Очередь рулетки живёт столько без heartbeat. */
    public const QUEUE_TTL_SEC = 90;

    public function __construct(private DatingService $dating) {}

    /**
     * Позвонить напрямую: мэтч, друг или собеседник из чата.
     *
     * Кнопка звонка живёт в шапке диалога — раз чат уже есть, звонить
     * можно: мэтч даёт режим match + match_id, остальное — direct.
     * Посторонним без диалога и связи — 403. Лимитов на прямые нет.
     * Выключенный приём у собеседника (video_calls_enabled) — 403.
     *
     * @param User $caller кто звонит
     * @param int $calleeId кому звонят
     * @param bool $audioOnly голосовой звонок без камеры
     * @return VideoCall созданный звонок в ringing
     *
     * @throws HttpResponseException 403 нет связи/гейт, 409 собеседник занят
     */
    public function startMatchCall(User $caller, int $calleeId, bool $audioOnly = false): VideoCall
    {
        $this->dating->assertAdult($caller);

        abort_if($caller->id === $calleeId, 422, 'Нельзя позвонить себе');

        $callee = User::findOrFail($calleeId);

        $match = DatingMatch::between($caller->id, $calleeId);
        $isFriend = Friendship::areFriends($caller->id, $calleeId);
        $hasChat = Conversation::findDirect($caller->id, $calleeId) !== null;

        abort_unless($match || $isFriend || $hasChat, 403, 'Сначала начни чат или добавь в друзья');

        $this->assertNotBlocked($caller->id, $calleeId);
        abort_if(! (bool) $callee->video_calls_enabled, 403, 'Собеседник отключил звонки');
        $this->sweepTimeouts($caller->id);
        $this->sweepTimeouts($calleeId);

        abort_if($this->hasLiveCall($caller->id), 409, 'У тебя уже есть активный звонок');
        abort_if($this->hasLiveCall($calleeId), 409, 'Собеседник сейчас занят');
        $this->assertRedialAllowed($caller->id, $calleeId);

        $call = VideoCall::create([
            'mode' => $match ? VideoCall::MODE_MATCH : VideoCall::MODE_DIRECT,
            'audio_only' => $audioOnly,
            'caller_id' => $caller->id,
            'callee_id' => $calleeId,
            'match_id' => $match?->id,
            'status' => VideoCall::STATUS_RINGING,
        ]);

        $this->broadcastIncoming($call);

        return $call;
    }

    /**
     * Принять входящий: только второй участник, только ringing.
     *
     * @param User $user принимающий
     * @param VideoCall $call звонок
     * @return VideoCall звонок в active
     */
    public function accept(User $user, VideoCall $call): VideoCall
    {
        $this->dating->assertAdult($user);
        $this->sweepCall($call);

        abort_unless($call->involves($user->id), 403, 'Чужой звонок');
        abort_unless($call->status === VideoCall::STATUS_RINGING, 409, 'Звонок уже завершён');

        $call->forceFill([
            'status' => VideoCall::STATUS_ACTIVE,
            'started_at' => now(),
        ])->save();

        $this->leaveQueue($user->id);
        $this->leaveQueue($call->peerId($user->id));
        $this->storeAndBroadcast($call, $user->id, VideoSignal::KIND_ACCEPTED, null);

        return $call->refresh();
    }

    /**
     * Отклонить входящий: только callee, только ringing.
     *
     * @param User $user отклоняющий
     * @param VideoCall $call звонок
     * @return VideoCall
     */
    public function decline(User $user, VideoCall $call): VideoCall
    {
        $this->sweepCall($call);

        abort_unless($call->involves($user->id), 403, 'Чужой звонок');
        abort_unless($call->status === VideoCall::STATUS_RINGING, 409, 'Звонок уже завершён');

        $call->forceFill([
            'status' => VideoCall::STATUS_DECLINED,
            'ended_at' => now(),
        ])->save();

        $this->storeAndBroadcast($call, $user->id, VideoSignal::KIND_DECLINED, null);
        $this->writeChatHistory($call, 'missed', $user->id);
        $this->pruneSignals($call->id);

        return $call->refresh();
    }

    /**
     * Положить трубку: любой участник живого звонка.
     *
     * @param User $user кто кладёт
     * @param VideoCall $call звонок
     * @return VideoCall
     */
    public function hangup(User $user, VideoCall $call): VideoCall
    {
        abort_unless($call->involves($user->id), 403, 'Чужой звонок');

        if (! $call->isLive()) {
            return $call;
        }

        $wasActive = $call->status === VideoCall::STATUS_ACTIVE;
        $startedAt = $call->started_at;

        $call->forceFill([
            'status' => VideoCall::STATUS_ENDED,
            'ended_at' => now(),
        ])->save();

        $this->storeAndBroadcast($call, $user->id, VideoSignal::KIND_HANGUP, null);
        // Carbon 3 отдаёт знаковый diff по умолчанию — берём абсолютный.
        $duration = $wasActive && $startedAt ? (int) max(0, now()->diffInSeconds($startedAt, true)) : null;
        $this->writeChatHistory($call, $wasActive ? 'ended' : 'missed', $user->id, $duration);
        $this->pruneSignals($call->id);

        return $call->refresh();
    }

    /**
     * Переслать signaling-фрейм второму участнику.
     *
     * Строка в БД — для polling-клиента, broadcast — для сокета.
     * Оба транспорта приносят один payload в user:video.signal.
     *
     * @param User $sender отправитель
     * @param VideoCall $call звонок
     * @param string $kind offer|answer|ice|chat
     * @param array|null $payload SDP, ICE-кандидат или {text} чата звонка
     * @return VideoSignal сохранённый сигнал
     */
    public function signal(User $sender, VideoCall $call, string $kind, ?array $payload): VideoSignal
    {
        abort_unless($call->involves($sender->id), 403, 'Чужой звонок');
        abort_unless($call->isLive(), 409, 'Звонок завершён');

        return $this->storeAndBroadcast($call, $sender->id, $kind, $payload);
    }

    /**
     * Встать в очередь рулетки и сразу попробовать найти пару.
     *
     * @param User $user ищущий
     * @param array $filters genitalia goal/gender как в ленте (optional)
     * @param bool $audioOnly голосовая рулетка без камеры
     * @return array{matched:bool, call:VideoCall|null}
     */
    public function joinRoulette(User $user, array $filters = [], bool $audioOnly = false): array
    {
        $this->dating->assertAdult($user);
        abort_if(! (bool) $user->video_calls_enabled, 403, 'Включи приём звонков в настройках');
        $this->assertRouletteQuota($user);
        $this->sweepTimeouts($user->id);

        abort_if($this->hasLiveCall($user->id), 409, 'Заверши текущий звонок');

        $partnerId = null;

        Cache::lock('video:roulette:lock', 5)->block(3, function () use ($user, $filters, $audioOnly, &$partnerId) {
            $queue = $this->readQueue();
            $queue = $this->pruneQueue($queue);

            $queue = array_values(array_filter($queue, fn ($row) => (int) $row['user_id'] !== (int) $user->id));

            $partnerId = $this->pickPartner($user, $queue, $filters, $audioOnly);

            if ($partnerId !== null) {
                $queue = array_values(array_filter($queue, fn ($row) => (int) $row['user_id'] !== (int) $partnerId));
                $this->writeQueue($queue);
                Cache::forget($this->memberKey($partnerId));
            } else {
                $queue[] = [
                    'user_id' => (int) $user->id,
                    'at' => now()->timestamp,
                    'gender' => $filters['gender'] ?? null,
                    'audio' => $audioOnly,
                ];
                $this->writeQueue($queue);
                Cache::put($this->memberKey($user->id), $filters, now()->addSeconds(self::QUEUE_TTL_SEC));
            }
        });

        if ($partnerId === null) {
            return ['matched' => false, 'call' => null];
        }

        $call = VideoCall::create([
            'mode' => VideoCall::MODE_ROULETTE,
            'audio_only' => $audioOnly,
            'caller_id' => (int) $partnerId,
            'callee_id' => (int) $user->id,
            'match_id' => null,
            'status' => VideoCall::STATUS_RINGING,
        ]);

        Cache::forget($this->memberKey($user->id));
        $this->broadcastIncoming($call);

        return ['matched' => true, 'call' => $call];
    }

    /**
     * Покинуть очередь рулетки.
     *
     * @param int $userId пользователь
     * @return void
     */
    public function leaveQueue(int $userId): void
    {
        try {
            Cache::lock('video:roulette:lock', 5)->block(3, function () use ($userId) {
                $queue = $this->pruneQueue($this->readQueue());
                $queue = array_values(array_filter($queue, fn ($row) => (int) $row['user_id'] !== $userId));
                $this->writeQueue($queue);
            });
        } catch (\Throwable) {
            return;
        }

        Cache::forget($this->memberKey($userId));
    }

    /**
     * «Дальше»: положить текущий и сразу встать в очередь.
     *
     * @param User $user листающий
     * @param VideoCall|null $call текущий звонок рулетки
     * @return array{matched:bool, call:VideoCall|null}
     */
    public function nextRoulette(User $user, ?VideoCall $call = null): array
    {
        $audioOnly = (bool) ($call?->audio_only ?? false);

        if ($call && $call->involves($user->id) && $call->isLive()) {
            $this->hangup($user, $call);
        }

        return $this->joinRoulette($user, [], $audioOnly);
    }

    /**
     * Публичный payload звонка для смотрящего.
     *
     * @param VideoCall $call звонок
     * @param int $viewerId смотрящий
     * @return array{id:int,mode:string,audio_only:bool,status:string,is_caller:bool,peer:array}
     */
    public function toPayload(VideoCall $call, int $viewerId): array
    {
        $peerId = $call->peerId($viewerId);
        $peer = User::find($peerId);

        return [
            'id' => (int) $call->id,
            'mode' => (string) $call->mode,
            'audio_only' => (bool) $call->audio_only,
            'status' => (string) $call->status,
            'is_caller' => (int) $call->caller_id === $viewerId,
            'created_at' => $call->created_at?->toISOString(),
            'peer' => $peer ? $this->brief($peer) : ['id' => $peerId, 'name' => 'Собеседник', 'avatar_url' => null],
        ];
    }

    /**
     * Сигналы звонка для добивки опросом (мёртвый realtime).
     *
     * Клиент тянет курсором after_id и разносит каждый в ту же шину
     * user:video.signal — дальше работают те же хендлеры, что для сокета.
     * Чужие (свои) фреймы не отдаём: отправитель их уже знает.
     *
     * @param VideoCall $call звонок
     * @param int $userId смотрящий (должен быть участником)
     * @param int $afterId последний известный id сигнала
     * @return array payloads как broadcastWith у VideoSignalEvent
     */
    public function callSignals(VideoCall $call, int $userId, int $afterId = 0): array
    {
        abort_unless($call->involves($userId), 403, 'Чужой звонок');

        return VideoSignal::where('call_id', $call->id)
            ->where('sender_id', '!=', $userId)
            ->when($afterId > 0, fn ($q) => $q->where('id', '>', $afterId))
            ->orderBy('id')
            ->limit(50)
            ->get()
            ->map(fn ($signal) => [
                'id' => (int) $signal->id,
                'call_id' => (int) $signal->call_id,
                'sender_id' => (int) $signal->sender_id,
                'kind' => (string) $signal->kind,
                'payload' => $signal->payload,
            ])
            ->all();
    }

    /**
     * Свежие входящие звонки для polling-тика.
     *
     * @param int $userId пользователь
     * @param \Carbon\Carbon|null $since момент прошлого тика
     * @return array payloads как broadcastWith
     */
    public function freshIncoming(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        $this->sweepTimeouts($userId);

        $rows = VideoCall::where(fn ($q) => $q->where('caller_id', $userId)->orWhere('callee_id', $userId))
            ->where('created_at', '>', $since)
            ->with(['caller:id,name,avatar_path', 'callee:id,name,avatar_path'])
            ->orderBy('id')
            ->limit(10)
            ->get();

        return $rows->map(fn ($call) => [
            'call_id' => (int) $call->id,
            'mode' => (string) $call->mode,
            'audio_only' => (bool) $call->audio_only,
            'caller' => $this->brief($call->caller),
            'callee' => $this->brief($call->callee),
        ])->all();
    }

    /**
     * Свежие сигналы для polling-тика (курсор по id, дедуп на клиенте).
     *
     * @param int $userId пользователь
     * @param \Carbon\Carbon|null $since момент прошлого тика
     * @param int $afterId последний известный id сигнала
     * @return array payloads как broadcastWith
     */
    public function freshSignals(int $userId, ?Carbon $since, int $afterId = 0): array
    {
        if (! $since) {
            return [];
        }

        $callIds = VideoCall::where(fn ($q) => $q->where('caller_id', $userId)->orWhere('callee_id', $userId))
            ->pluck('id')
            ->all();

        if (empty($callIds)) {
            return [];
        }

        $query = VideoSignal::whereIn('call_id', $callIds)
            ->where('sender_id', '!=', $userId)
            ->orderBy('id')
            ->limit(50);

        if ($afterId > 0) {
            $query->where('id', '>', $afterId);
        } else {
            $query->where('created_at', '>', $since);
        }

        return $query->get()->map(fn ($signal) => [
            'id' => (int) $signal->id,
            'call_id' => (int) $signal->call_id,
            'sender_id' => (int) $signal->sender_id,
            'kind' => (string) $signal->kind,
            'payload' => $signal->payload,
        ])->all();
    }

    /**
     * Висящие входящие для добивки: звонки ringing, где я участник.
     *
     * Страховка на случай мёртвого realtime (сокет не поднялся,
     * user-канал не подписался, старый бандл): клиент дёргает
     * endpoint раз в несколько секунд, пока сокет не ожил.
     *
     * @param User $user смотрящий
     * @return array payloads как broadcastWith у VideoIncoming
     */
    public function pendingIncoming(User $user): array
    {
        $this->sweepTimeouts($user->id);

        $rows = VideoCall::where(fn ($q) => $q->where('caller_id', $user->id)->orWhere('callee_id', $user->id))
            ->where('status', VideoCall::STATUS_RINGING)
            ->where('created_at', '>=', now()->subSeconds(VideoCall::RING_TTL_SEC))
            ->with(['caller:id,name,avatar_path', 'callee:id,name,avatar_path'])
            ->orderBy('id')
            ->limit(5)
            ->get();

        return $rows->map(fn ($call) => [
            'call_id' => (int) $call->id,
            'mode' => (string) $call->mode,
            'audio_only' => (bool) $call->audio_only,
            'caller' => $this->brief($call->caller),
            'callee' => $this->brief($call->callee),
        ])->all();
    }

    /**
     * Сколько живых мест в очереди рулетки (для бейджа «сейчас в рулетке»).
     *
     * Только чтение без лока: место живо, пока свежая метка и member-ключ.
     *
     * @return int
     */
    public function queueCount(): int
    {
        $queue = $this->readQueue();
        $now = now()->timestamp;
        $count = 0;

        foreach ($queue as $row) {
            $userId = (int) ($row['user_id'] ?? 0);

            if ($userId <= 0) {
                continue;
            }

            if (($now - (int) ($row['at'] ?? 0)) > self::QUEUE_TTL_SEC) {
                continue;
            }

            if (! Cache::has($this->memberKey($userId))) {
                continue;
            }

            $count++;
        }

        return $count;
    }

    /**
     * Есть ли у пользователя живой звонок.
     *
     * @param int $userId пользователь
     * @return bool
     */
    public function hasLiveCall(int $userId): bool
    {
        return VideoCall::where(fn ($q) => $q->where('caller_id', $userId)->orWhere('callee_id', $userId))
            ->whereIn('status', [VideoCall::STATUS_RINGING, VideoCall::STATUS_ACTIVE])
            ->exists();
    }

    /**
     * Проверить кулдаун повторного дозвонка после отказа.
     *
     * Считаются только несостоявшиеся прямые звонки от меня ему
     * (declined/timeout/отбой до ответа). Состоявшийся разговор
     * кулдауна не даёт — перезвонить можно сразу.
     * Кулдаун применяется только когда его включил принимающий
     * (настройка «Защита от дозвонов»), иначе дозвон свободный.
     *
     * @param int $callerId кто звонит
     * @param int $calleeId кому звонят
     * @return void
     *
     * @throws HttpResponseException 429 с остатком кулдауна
     */
    private function assertRedialAllowed(int $callerId, int $calleeId): void
    {
        $callee = User::find($calleeId);

        if (! $callee || ! (bool) $callee->call_cooldown_enabled) {
            return;
        }

        $last = VideoCall::where('caller_id', $callerId)
            ->where('callee_id', $calleeId)
            ->whereIn('mode', [VideoCall::MODE_MATCH, VideoCall::MODE_DIRECT])
            ->where(fn ($q) => $q
                ->whereIn('status', [VideoCall::STATUS_DECLINED, VideoCall::STATUS_TIMEOUT])
                ->orWhere(fn ($x) => $x->where('status', VideoCall::STATUS_ENDED)->whereNull('started_at')))
            ->orderByDesc('id')
            ->first();

        if (! $last || ! $last->ended_at) {
            return;
        }

        $wait = self::REDIAL_COOLDOWN_SEC - now()->diffInSeconds($last->ended_at, true);

        if ($wait <= 0) {
            return;
        }

        $label = $wait >= 60
            ? 'через '.ceil($wait / 60).' мин'
            : "через $wait сек";

        throw new HttpResponseException(response()->json([
            'message' => "Собеседник отклонил звонок. Повторно — $label.",
        ], 429));
    }

    /**
     * Погасить протухшие ringing пользователя (ленивый таймаут без cron).
     *
     * @param int $userId пользователь
     * @return void
     */
    private function sweepTimeouts(int $userId): void
    {
        $expired = VideoCall::where(fn ($q) => $q->where('caller_id', $userId)->orWhere('callee_id', $userId))
            ->where('status', VideoCall::STATUS_RINGING)
            ->where('created_at', '<', now()->subSeconds(VideoCall::RING_TTL_SEC))
            ->get();

        foreach ($expired as $call) {
            $this->markTimeout($call);
        }
    }

    /**
     * Погасить один звонок если протух.
     *
     * @param VideoCall $call звонок
     * @return void
     */
    private function sweepCall(VideoCall $call): void
    {
        if ($call->status !== VideoCall::STATUS_RINGING) {
            return;
        }

        $created = $call->created_at ?? now();

        if ($created->lt(now()->subSeconds(VideoCall::RING_TTL_SEC))) {
            $this->markTimeout($call->refresh());
        }
    }

    /**
     * Перевести звонок в timeout и уведомить обоих.
     *
     * @param VideoCall $call звонок
     * @return void
     */
    private function markTimeout(VideoCall $call): void
    {
        if ($call->status !== VideoCall::STATUS_RINGING) {
            return;
        }

        $call->forceFill([
            'status' => VideoCall::STATUS_TIMEOUT,
            'ended_at' => now(),
        ])->save();

        try {
            $this->storeAndBroadcast($call, (int) $call->caller_id, VideoSignal::KIND_TIMEOUT, null);
        } catch (\Throwable $e) {
            Log::warning('video timeout broadcast failed: '.$e->getMessage());
        }

        $this->writeChatHistory($call, 'missed', (int) $call->caller_id);
        $this->pruneSignals($call->id);
    }

    /**
     * Сохранить сигнал и разослать получателю.
     *
     * @param VideoCall $call звонок
     * @param int $senderId отправитель
     * @param string $kind вид фрейма
     * @param array|null $payload данные
     * @return VideoSignal
     */
    private function storeAndBroadcast(VideoCall $call, int $senderId, string $kind, ?array $payload): VideoSignal
    {
        // ВРЕМЕННАЯ диагностика битого SDP (убрать после починки звонков):
        // пишет длину и json-кодированные голову/хвост sdp — так видны
        // невидимые символы, обрезка и потеря \r\n. IP в логах не светим.
        if (in_array($kind, [VideoSignal::KIND_OFFER, VideoSignal::KIND_ANSWER], true) && is_string($payload['sdp'] ?? null)) {
            $sdp = (string) $payload['sdp'];
            Log::info('video.sdp_debug', [
                'call' => (int) $call->id,
                'kind' => $kind,
                'type' => (string) ($payload['type'] ?? ''),
                'len' => strlen($sdp),
                'crlf' => substr_count($sdp, "\r\n"),
                'lf' => substr_count($sdp, "\n"),
                'head' => mb_substr(json_encode(mb_substr($sdp, 0, 200)), 0, 400),
                'tail' => mb_substr(json_encode(mb_substr($sdp, -200)), 0, 400),
            ]);
        }

        $signal = VideoSignal::create([
            'call_id' => $call->id,
            'sender_id' => $senderId,
            'kind' => $kind,
            'payload' => $payload,
        ]);

        try {
            broadcast(new VideoSignalEvent(
                (int) $signal->id,
                (int) $call->id,
                $senderId,
                $call->peerId($senderId),
                $kind,
                $payload,
            ))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('video signal broadcast failed: '.$e->getMessage());
        }

        return $signal;
    }

    /**
     * Разослать входящий звонок обоим участникам.
     *
     * @param VideoCall $call звонок
     * @return void
     */
    private function broadcastIncoming(VideoCall $call): void
    {
        $call->loadMissing(['caller:id,name,avatar_path', 'callee:id,name,avatar_path']);

        try {
            broadcast(new VideoIncoming(
                (int) $call->id,
                (string) $call->mode,
                $this->brief($call->caller),
                $this->brief($call->callee),
                (bool) $call->audio_only,
            ))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('video incoming broadcast failed: '.$e->getMessage());
        }
    }

    /**
     * Записать итог звонка в direct-чат системным сообщением.
     *
     * Только режимы match/direct (у рулетки чата нет). Сообщение летит
     * обычным MessageSent — открытый диалог и превью обновляются сами,
     * в polling доедет следующим тиком как новое сообщение.
     * Переходы терминальные (один финиш — одна запись), дублей нет.
     *
     * @param VideoCall $call завершённый звонок
     * @param string $kind missed|ended
     * @param int $actorId кто завершил (подпись sender_id)
     * @param int|null $durationSec длительность для ended
     * @return void
     */
    private function writeChatHistory(VideoCall $call, string $kind, int $actorId, ?int $durationSec = null): void
    {
        if (! in_array($call->mode, [VideoCall::MODE_MATCH, VideoCall::MODE_DIRECT], true)) {
            return;
        }

        try {
            $conv = Conversation::findDirect((int) $call->caller_id, (int) $call->callee_id);

            if (! $conv) {
                return;
            }

            $body = $kind === 'ended'
                ? '📞 Звонок · '.$this->formatDuration($durationSec ?? 0)
                : '📞 Пропущенный звонок';

            $msg = Message::create([
                'conversation_id' => $conv->id,
                'sender_id' => $actorId,
                'body' => $body,
                'type' => 'system',
            ]);

            $conv->update(['last_message_at' => $msg->created_at]);
            $conv->participantRows()->update(['hidden_at' => null]);

            $msg->loadMissing(['sender:id,name,avatar_path', 'conversation.participantRows']);
            broadcast(new \App\Events\MessageSent($msg))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('video chat history failed: '.$e->getMessage());
        }
    }

    /**
     * Человеческая длительность звонка.
     *
     * @param int $sec секунды
     * @return string «меньше минуты», «4:07», «1:02:03»
     */
    private function formatDuration(int $sec): string
    {
        if ($sec < 60) {
            return 'меньше минуты';
        }

        $hours = intdiv($sec, 3600);
        $mins = intdiv($sec % 3600, 60);
        $secs = $sec % 60;

        if ($hours > 0) {
            return sprintf('%d:%02d:%02d', $hours, $mins, $secs);
        }

        return sprintf('%d:%02d', $mins, $secs);
    }

    /**
     * Удалить старые сигналы завершённого звонка (сигналы нужны только живым).
     *
     * @param int $callId звонок
     * @return void
     */
    private function pruneSignals(int $callId): void
    {
        try {
            VideoSignal::where('call_id', $callId)
                ->where('created_at', '<', now()->subHour())
                ->delete();
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Была ли у пары рулетка в последнюю минуту.
     *
     * @param int $a первый
     * @param int $b второй
     * @return bool
     */
    private function recentlyPaired(int $a, int $b): bool
    {
        return VideoCall::where('mode', VideoCall::MODE_ROULETTE)
            ->where(fn ($q) => $q
                ->where(fn ($x) => $x->where('caller_id', $a)->where('callee_id', $b))
                ->orWhere(fn ($x) => $x->where('caller_id', $b)->where('callee_id', $a)))
            ->where('created_at', '>=', now()->subMinute())
            ->exists();
    }

    /**
     * Краткий профиль пира.
     *
     * @param User $user пользователь
     * @return array{id:int,name:string,avatar_url:string|null}
     */
    private function brief(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'name' => (string) $user->name,
            'avatar_url' => $user->avatar_url,
        ];
    }

    /**
     * Проверить отсутствие блока в обе стороны.
     *
     * @param int $a первый
     * @param int $b второй
     * @return void
     *
     * @throws HttpResponseException 403 при блоке
     */
    private function assertNotBlocked(int $a, int $b): void
    {
        $blocked = UserBlock::where(fn ($q) => $q
            ->where(fn ($x) => $x->where('blocker_id', $a)->where('blocked_id', $b))
            ->orWhere(fn ($x) => $x->where('blocker_id', $b)->where('blocked_id', $a)))
            ->exists();

        abort_if($blocked, 403, 'Звонок недоступен');
    }

    /**
     * Проверить дневной лимит рулетки.
     *
     * @param User $user пользователь
     * @return void
     *
     * @throws HttpResponseException 402 лимит исчерпан
     */
    private function assertRouletteQuota(User $user): void
    {
        if ($user->isAdmin() || $user->isPro()) {
            return;
        }

        $today = VideoCall::where(fn ($q) => $q->where('caller_id', $user->id)->orWhere('callee_id', $user->id))
            ->where('mode', VideoCall::MODE_ROULETTE)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();

        if ($today >= self::FREE_ROULETTE_PER_DAY) {
            throw new HttpResponseException(response()->json([
                'message' => 'Дневной лимит рулетки исчерпан — оформи PRO',
            ], 402));
        }
    }

    /**
     * Ключ живости участника очереди.
     *
     * @param int $userId пользователь
     * @return string
     */
    private function memberKey(int $userId): string
    {
        return "video:roulette:member:{$userId}";
    }

    /**
     * Прочитать очередь рулетки.
     *
     * @return array<int, array{user_id:int,at:int,gender:string|null}>
     */
    private function readQueue(): array
    {
        $queue = Cache::get('video:roulette:queue', []);

        return is_array($queue) ? array_values($queue) : [];
    }

    /**
     * Записать очередь рулетки.
     *
     * @param array $queue очередь
     * @return void
     */
    private function writeQueue(array $queue): void
    {
        Cache::put('video:roulette:queue', array_values($queue), now()->addMinutes(10));
    }

    /**
     * Выкинуть протухших из очереди.
     *
     * @param array $queue очередь
     * @return array живая очередь
     */
    private function pruneQueue(array $queue): array
    {
        $now = now()->timestamp;

        return array_values(array_filter($queue, function ($row) use ($now) {
            $userId = (int) ($row['user_id'] ?? 0);

            if ($userId <= 0) {
                return false;
            }

            if (($now - (int) ($row['at'] ?? 0)) > self::QUEUE_TTL_SEC) {
                Cache::forget($this->memberKey($userId));

                return false;
            }

            if (! Cache::has($this->memberKey($userId))) {
                return false;
            }

            return true;
        }));
    }

    /**
     * Подобрать партнёра из очереди: не себя, без блоков и живых звонков.
     *
     * Недавний собеседник (общий roulette-звонок younger минуты) пропускается:
     * иначе «Дальше» при онлайне в два человека бесконечно сводит одну пару.
     *
     * @param User $me ищущий
     * @param array $queue живая очередь
     * @param array $filters фильтры (gender)
     * @param bool $audioOnly ищущий хочет голосом — сначала ищем такого же
     * @return int|null id партнёра
     */
    private function pickPartner(User $me, array $queue, array $filters, bool $audioOnly): ?int
    {
        usort($queue, fn ($a, $b) => (int) ($a['at'] ?? 0) <=> (int) ($b['at'] ?? 0));

        $fallbackId = null;

        foreach ($queue as $row) {
            $candidateId = (int) ($row['user_id'] ?? 0);

            if ($candidateId <= 0 || $candidateId === (int) $me->id) {
                continue;
            }

            if ($this->recentlyPaired((int) $me->id, $candidateId)) {
                continue;
            }

            if ($this->hasLiveCall($candidateId)) {
                continue;
            }

            $blocked = UserBlock::where(fn ($q) => $q
                ->where(fn ($x) => $x->where('blocker_id', $me->id)->where('blocked_id', $candidateId))
                ->orWhere(fn ($x) => $x->where('blocker_id', $candidateId)->where('blocked_id', $me->id)))
                ->exists();

            if ($blocked) {
                continue;
            }

            $wanted = $filters['gender'] ?? null;

            if (is_string($wanted) && in_array($wanted, ['male', 'female'], true)) {
                $candidate = User::find($candidateId);

                if (! $candidate || ($candidate->gender !== $wanted && $candidate->gender !== null)) {
                    continue;
                }
            }

            $candidateAudio = (bool) ($row['audio'] ?? false);

            if ($candidateAudio === $audioOnly) {
                return $candidateId;
            }

            $fallbackId ??= $candidateId;
        }

        return $fallbackId;
    }
}
