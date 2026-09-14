<?php

namespace App\Events;

use App\Models\District;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Изменён UDistrict: обновить заливку и карточку всем в realtime.
 */
class DistrictUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(public District $district) {}
    public function broadcastOn(): array { return [new Channel('map')]; }
    public function broadcastAs(): string { return 'district.updated'; }
    public function broadcastWith(): array { return ['district' => $this->district->toPublicArray()]; }
}
