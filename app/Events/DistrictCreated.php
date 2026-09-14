<?php

namespace App\Events;

use App\Models\District;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Создан UDistrict: слой карты дорисовать заливку всем в realtime.
 */
class DistrictCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(public District $district) {}
    public function broadcastOn(): array { return [new Channel('map')]; }
    public function broadcastAs(): string { return 'district.created'; }
    public function broadcastWith(): array { return ['district' => $this->district->toPublicArray()]; }
}
