<?php

namespace App\Events;

use App\Models\PinActivity;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PinActivityCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public ?PinActivity $activity,
        public int $pinId,
        public int $ownerId,
        public int $reactionsCount,
        public int $commentsCount,
    ) {}

    public function broadcastOn(): array
    {
        return [
            new Channel('map'),
            new PrivateChannel('user.'.$this->ownerId),
        ];
    }

    public function broadcastAs(): string { return 'pin.activity'; }

    public function broadcastWith(): array
    {
        return [
            'pin_id' => $this->pinId,
            'reactions_count' => $this->reactionsCount,
            'comments_count' => $this->commentsCount,
            'activity' => $this->activity?->toNotifyArray(),
        ];
    }
}
