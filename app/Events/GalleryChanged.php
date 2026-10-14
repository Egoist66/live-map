<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Галерея пользователя изменилась: offline-кеш надо точечно пересчитать.
 *
 * Шлётся в личный канал владельца (user.{id}): свои мутации
 * (upload/replace/remove/makeMain) мгновенно инвалидируют кеш на
 * других устройствах/вкладках. Чужим галереям событие не летит —
 * их покрывает TTL + ревалидация при открытии. Polling-транспорт
 * зеркалит то же через gallery_version в RealtimeController::sync.
 */
class GalleryChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $userId владелец галереи
     * @param int $version версия изменения (ms epoch)
     */
    public function __construct(public int $userId, public int $version) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    /**
     * @return array{user_id:int, version:int}
     */
    public function broadcastWith(): array
    {
        return ['user_id' => $this->userId, 'version' => $this->version];
    }

    public function broadcastAs(): string { return 'gallery.changed'; }
}
