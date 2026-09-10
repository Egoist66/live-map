<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Обновление у пользователя, на которого подписаны: пин / фото / репутация / уровень.
 */
class UserFeedUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $subscriberId кому слать
     * @param string $kind pin|photo|level
     * @param array $actor автор обновления ['id','name','avatar_path','avatar_url']
     * @param array $payload детали (pin_id/title, photo_id/url, reputation_score/level)
     */
    public function __construct(
        public int $subscriberId,
        public string $kind,
        public array $actor,
        public array $payload = [],
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->subscriberId)];
    }

    public function broadcastAs(): string
    {
        return 'user.feed.updated';
    }

    public function broadcastWith(): array
    {
        return [
            'kind' => $this->kind,
            'actor' => $this->actor,
            'payload' => $this->payload,
        ];
    }

    /**
     * Собрать представление автора из модели.
     */
    public static function actorOf(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'avatar_path' => $user->avatar_path,
            'avatar_url' => $user->avatar_url,
        ];
    }
}
