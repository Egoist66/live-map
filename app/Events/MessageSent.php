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
        // Групповые чаты (UDistrict): сообщение едет всем участникам,
        // иначе район узнаёт о нём только первый в списке.
        $ids = $this->message->conversation->participantRows
            ->pluck('user_id')
            ->filter(fn ($id) => (int) $id !== (int) $this->message->sender_id)
            ->unique()
            ->values();
        $channels = [new PrivateChannel('chat.' . $this->message->conversation_id)];
        foreach ($ids as $uid) {
            $channels[] = new PrivateChannel('user.' . $uid);
        }

        return $channels;
    }

    public function broadcastWith(): array
    {
        $this->message->loadMissing(['sender:id,name,avatar_path,telegram_photo_url', 'replyTo.sender:id,name']);
        return ['message' => $this->message->toArrayPayload()];
    }

    public function broadcastAs(): string { return 'message.sent'; }
}
