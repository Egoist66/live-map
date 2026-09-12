<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Новое уведомление в личном канале (единый realtime-источник тостов).
 */
class NotificationCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $ownerId получатель
     * @param array $notification строка UserNotifier::serialize()
     */
    public function __construct(
        public int $ownerId,
        public array $notification,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->ownerId),
        ];
    }

    public function broadcastAs(): string { return 'notification.created'; }

    public function broadcastWith(): array
    {
        return [
            'notification' => $this->notification,
        ];
    }
}
