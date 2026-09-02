<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message) {}

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('chat.' . $this->message->conversation_id),
            new PrivateChannel('user.' . $this->message->conversation->participantRows->pluck('user_id')->filter(fn($id)=>$id!==$this->message->sender_id)->first()),
        ];
    }

    public function broadcastWith(): array
    {
        $this->message->load('sender:id,name,avatar_path');
        return ['message' => $this->message->toArrayPayload()];
    }

    public function broadcastAs(): string { return 'message.sent'; }
}
