<?php

namespace App\Events;

use App\Models\Report;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ReportCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Report $report, public array $adminIds) {}

    public function broadcastOn(): array
    {
        return array_map(fn ($id) => new PrivateChannel('user.'.$id), array_unique($this->adminIds));
    }

    public function broadcastAs(): string { return 'report.created'; }

    public function broadcastWith(): array
    {
        $this->report->loadMissing(['reporter:id,name,avatar_path']);
        return ['report' => $this->report->toNotifyArray()];
    }
}
