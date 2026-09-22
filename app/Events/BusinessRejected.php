<?php

namespace App\Events;

use App\Models\Business;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Бизнес отклонён модерацией — уведомить владельца в realtime.
 *
 * Фронт слушает private `user.{id}` событие `business.rejected`
 * в useBusinessProfile + useAppNotifications (тост + звук),
 * polling дублирует через inbox (BusinessRejectedNotification).
 */
class BusinessRejected implements ShouldBroadcastNow
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
        return 'business.rejected';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['business' => $this->business->toCabinetArray()];
    }
}
