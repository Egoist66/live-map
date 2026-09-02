<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class PinDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(public int $pinId) {}
    public function broadcastOn(): array { return [new Channel('map')]; }
    public function broadcastAs(): string { return 'pin.deleted'; }
    public function broadcastWith(): array { return ['pinId' => $this->pinId]; }
}
