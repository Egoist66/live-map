<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PinCountersUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $pinId,
        public int $reactionsCount,
        public int $commentsCount,
    ) {}

    public function broadcastOn(): array
    {
        return [new Channel('map')];
    }

    public function broadcastAs(): string { return 'pin.activity'; }

    public function broadcastWith(): array
    {
        return [
            'pin_id' => $this->pinId,
            'reactions_count' => $this->reactionsCount,
            'comments_count' => $this->commentsCount,
            'activity' => null,
        ];
    }
}
