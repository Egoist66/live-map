<?php

namespace App\Events;

use App\Models\Friendship;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class FriendshipUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
    public function __construct(public Friendship $friendship) {}
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->friendship->requester_id),
            new PrivateChannel('user.'.$this->friendship->addressee_id),
        ];
    }
    public function broadcastAs(): string { return 'friendship.updated'; }
    public function broadcastWith(): array
    {
        $this->friendship->load(['requester:id,name,avatar_path','addressee:id,name,avatar_path']);
        return ['friendship'=>[
            'id'=>$this->friendship->id,
            'requester_id'=>$this->friendship->requester_id,
            'addressee_id'=>$this->friendship->addressee_id,
            'status'=>$this->friendship->status,
            'requester'=>$this->friendship->requester,
            'addressee'=>$this->friendship->addressee,
        ]];
    }
}
