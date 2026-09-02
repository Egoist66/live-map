<?php

namespace App\Events;

use App\Models\Pin;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

class PinUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(public Pin $pin) {}
    public function broadcastOn(): array { return [new Channel('map')]; }
    public function broadcastAs(): string { return 'pin.updated'; }
    public function broadcastWith(): array { return ['pin' => $this->pin->toPublicArray()]; }
}
