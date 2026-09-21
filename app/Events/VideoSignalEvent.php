<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Один signaling-фрейм: offer/answer/ice + служебные accepted/declined/hangup.
 *
 * Двойная доставка: broadcast получателю (сокет) + строка video_signals
 * в БД (polling через sync()). Получатель один — второй участник звонка.
 */
class VideoSignalEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $signalId id строки video_signals (курсор дедупа поллинга)
     * @param int $callId id звонка
     * @param int $senderId кто отправил
     * @param int $recipientId кому доставить
     * @param string $kind offer|answer|ice|accepted|declined|hangup|timeout|joined
     * @param array|null $payload SDP / ICE-кандидат
     */
    public function __construct(
        public int $signalId,
        public int $callId,
        public int $senderId,
        public int $recipientId,
        public string $kind,
        public ?array $payload,
    ) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->recipientId)];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'id' => $this->signalId,
            'call_id' => $this->callId,
            'sender_id' => $this->senderId,
            'kind' => $this->kind,
            'payload' => $this->payload,
        ];
    }

    public function broadcastAs(): string
    {
        return 'video.signal';
    }
}
