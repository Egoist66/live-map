<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Смена общего фона беседы: прилетает всем участникам канала.
 */
class ConversationWallpaperUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Conversation $conversation,
        public int $updatedBy,
    ) {}

    /**
     * @return array<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('chat.'.$this->conversation->id)];
    }

    /**
     * @return array{conversation_id:int,wallpaper:array,updated_by:int}
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => (int) $this->conversation->id,
            'wallpaper' => $this->conversation->wallpaperPayload(),
            'updated_by' => (int) $this->updatedBy,
        ];
    }

    public function broadcastAs(): string { return 'conversation.wallpaper'; }
}
