<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Входящий голосовой звонок: доставляется обоим участникам.
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
        public bool $audioOnly = false,
        public ?array $peerBrief = null,
        public ?int $recipientId = null,
    ) {}

    /**
     * Канал получателя: пир персонализирован под него (peer — всегда второй
     * участник), поэтому клиент не гадает по своему id и не путает стороны
     * при протухшем кэше аккаунта.
     *
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        if ($this->recipientId) {
            return [new PrivateChannel('user.'.$this->recipientId)];
        }

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
            'audio_only' => $this->audioOnly,
            'caller' => $this->callerBrief,
            'callee' => $this->calleeBrief,
            'peer' => $this->peerBrief,
            'recipient_id' => $this->recipientId,
        ];
    }

    public function broadcastAs(): string
    {
        return 'video.incoming';
    }
}
