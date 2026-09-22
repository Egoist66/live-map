<?php

namespace App\Events;

use App\Models\Business;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Бизнес прошёл проверку — уведомить владельца в realtime.
 *
 * Фронт слушает private `user.{id}` событие `business.verified`
 * в useBusinessRealtime (кабинет: стор + статус), useBusinessProfile
 * и useAppNotifications (тост + звук).
 */
class BusinessVerified implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public Business $business) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.' . $this->business->user_id)];
    }

    public function broadcastAs(): string
    {
        return 'business.verified';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['business' => $this->business->toCabinetArray()];
    }
}
