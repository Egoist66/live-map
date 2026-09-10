<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Одиночный лайк в ULove (ещё без мэтча).
 *
 * Уведомляет получателя, чтобы было видно,
 * кто как реагирует, даже вне страницы ULove.
 */
class SwipeLiked implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param array{id:int,name:string,avatar_url:string|null} $liker кто лайкнул
     * @param int $likedId кому прилетел лайк
     * @param int|null $conversationId комната мэтча (только при мэтче, иначе null)
     */
    public function __construct(
        public array $liker,
        public int $likedId,
        public ?int $conversationId = null,
    ) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->likedId)];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'liker' => $this->liker,
            'conversation_id' => $this->conversationId,
        ];
    }

    public function broadcastAs(): string
    {
        return 'swipe.liked';
    }
}
