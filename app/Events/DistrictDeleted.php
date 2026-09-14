<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Удалён UDistrict: убрать заливку с карты всем в realtime.
 */
class DistrictDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;
    public function __construct(public int $districtId) {}
    public function broadcastOn(): array { return [new Channel('map')]; }
    public function broadcastAs(): string { return 'district.deleted'; }
    public function broadcastWith(): array { return ['districtId' => $this->districtId]; }
}
