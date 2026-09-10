<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public Message $message) {}

    public function broadcastOn(): array
    {
        $otherId = $this->message->conversation->participantRows->pluck('user_id')->firstWhere(fn($id)=>$id!==$this->message->sender_id);
        $channels = [new PrivateChannel('chat.' . $this->message->conversation_id)];
        if($otherId) $channels[] = new PrivateChannel('user.'.$otherId);
        return $channels;
    }

    public function broadcastWith(): array
    {
        $this->message->loadMissing(['sender:id,name,avatar_path', 'replyTo.sender:id,name']);
        return ['message' => $this->message->toArrayPayload()];
    }

    public function broadcastAs(): string { return 'message.sent'; }
}
