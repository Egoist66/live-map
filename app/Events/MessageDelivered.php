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
    public function broadcastOn(): array {
        // Как и MessageRead: chat-канал + лички всех участников, иначе
        // отправитель без открытого диалога не узнает о доставке по сокету
        // (тики висят на одной птичке до ручного рефреша).
        $channels = [new PrivateChannel('chat.'.$this->conversationId)];
        try {
            $ids = \App\Models\Conversation::find($this->conversationId)?->participantRows()->pluck('user_id') ?? [];
            foreach ($ids as $id) $channels[] = new PrivateChannel('user.'.$id);
        } catch (\Throwable $e) {}
        return $channels;
    }
    public function broadcastAs(): string { return 'message.delivered'; }
    public function broadcastWith(): array { return ['conversation_id'=>$this->conversationId,'message_ids'=>$this->messageIds,'user_id'=>$this->userId,'delivered_at'=>now()->toISOString()]; }
}
