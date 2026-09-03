<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageRead implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
    public function __construct(public int $conversationId, public int $userId, public array $messageIds = []) {}
    public function broadcastOn(): array { return [new PrivateChannel('chat.'.$this->conversationId)]; }
    public function broadcastAs(): string { return 'message.read'; }
    public function broadcastWith(): array { return ['conversation_id'=>$this->conversationId,'user_id'=>$this->userId,'message_ids'=>$this->messageIds,'read_at'=>now()->toISOString()]; }
}
