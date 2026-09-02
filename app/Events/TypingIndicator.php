<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TypingIndicator implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
    public function __construct(public int $conversationId, public int $userId, public bool $isTyping) {}
    public function broadcastOn(): array { return [new PrivateChannel('chat.'.$this->conversationId)]; }
    public function broadcastAs(): string { return 'typing'; }
    public function broadcastWith(): array { return ['conversation_id'=>$this->conversationId,'user_id'=>$this->userId,'is_typing'=>$this->isTyping]; }
}
