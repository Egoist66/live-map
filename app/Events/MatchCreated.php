<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Взаимный мэтч в ULove: уведомляет обоих участников.
 *
 * Слушается глобально (useAppNotifications, badges, useSwipes),
 * чтобы мэтч был виден не только на странице ULove,
 * но и в общих уведомлениях и табе ULove в чате.
 */
class MatchCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $matchId id мэтча
     * @param int $conversationId id комнаты-чата мэтча
     * @param array{id:int,name:string,avatar_url:string|null} $userA первый участник
     * @param array{id:int,name:string,avatar_url:string|null} $userB второй участник
     */
    public function __construct(
        public int $matchId,
        public int $conversationId,
        public array $userA,
        public array $userB,
    ) {}

    /**
     * Каналы обоих участников.
     *
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->userA['id']),
            new PrivateChannel('user.'.$this->userB['id']),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'match_id' => $this->matchId,
            'conversation_id' => $this->conversationId,
            'user_a' => $this->userA,
            'user_b' => $this->userB,
        ];
    }

    public function broadcastAs(): string
    {
        return 'match.created';
    }
}
