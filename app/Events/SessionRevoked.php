<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Сеансы пользователя отозваны: жертва должна мгновенно вылететь.
 *
 * Слушают watchdog фронта (сокет) и запасной путь через 401 поллинга.
 */
class SessionRevoked implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $ownerId владелец отозванных сеансов
     * @param array<int, string> $sessionIds id строк sessions, которых больше нет
     */
    public function __construct(
        public int $ownerId,
        public array $sessionIds,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->ownerId),
        ];
    }

    public function broadcastAs(): string { return 'session.revoked'; }

    public function broadcastWith(): array
    {
        return [
            'session_ids' => array_values($this->sessionIds),
        ];
    }
}
