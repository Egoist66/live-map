<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;
    public function __construct(public int $messageId, public int $conversationId) {}
    public function broadcastOn(): array
    {
        $channels = [new PrivateChannel('chat.' . $this->conversationId)];
        try {
            $ids = \App\Models\Conversation::find($this->conversationId)?->participantRows()->pluck('user_id') ?? [];
            foreach ($ids as $id) {
                $channels[] = new PrivateChannel('user.' . $id);
            }
        } catch (\Throwable $e) {
        }
        return $channels;
    }
    public function broadcastAs(): string { return 'message.deleted'; }
    public function broadcastWith(): array { return ['message_id'=>$this->messageId,'conversation_id'=>$this->conversationId]; }
}
