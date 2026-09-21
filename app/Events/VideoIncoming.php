<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Входящий видеозвонок: доставляется обоим участникам.
 *
 * Сокет — мгновенно, polling — следующим тиком sync() (freshVideoIncoming).
 * Фронт слушает каноническое user:video.incoming в обоих режимах.
 */
class VideoIncoming implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $callId id звонка
     * @param string $mode match|roulette
     * @param array{id:int,name:string,avatar_url:string|null} $callerBrief кто звонит
     * @param array{id:int,name:string,avatar_url:string|null} $calleeBrief кому звонят
     */
    public function __construct(
        public int $callId,
        public string $mode,
        public array $callerBrief,
        public array $calleeBrief,
    ) {}

    /**
     * Каналы обоих участников: рулетка ждёт с двух сторон сразу.
     *
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->callerBrief['id']),
            new PrivateChannel('user.'.$this->calleeBrief['id']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'call_id' => $this->callId,
            'mode' => $this->mode,
            'caller' => $this->callerBrief,
            'callee' => $this->calleeBrief,
        ];
    }

    public function broadcastAs(): string
    {
        return 'video.incoming';
    }
}
