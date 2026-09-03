<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageDelivered implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
    public function __construct(public int $conversationId, public array $messageIds, public int $userId) {}
    public function broadcastOn(): array { return [new PrivateChannel('chat.'.$this->conversationId)]; }
    public function broadcastAs(): string { return 'message.delivered'; }
    public function broadcastWith(): array { return ['conversation_id'=>$this->conversationId,'message_ids'=>$this->messageIds,'user_id'=>$this->userId,'delivered_at'=>now()->toISOString()]; }
}
