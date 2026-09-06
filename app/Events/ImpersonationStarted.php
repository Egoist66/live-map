<?php

namespace App\Events;

use App\Models\AdminImpersonationLog;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ImpersonationStarted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public AdminImpersonationLog $log) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->log->target_user_id)];
    }

    public function broadcastAs(): string { return 'impersonation.started'; }

    public function broadcastWith(): array
    {
        return ['log' => [
            'id' => $this->log->id,
            'reason' => $this->log->reason,
            'started_at' => $this->log->started_at?->toISOString(),
        ]];
    }
}
