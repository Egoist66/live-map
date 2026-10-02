<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Заметки «Избранного» изменились — обновиться другим устройствам.
 *
 * Канал user.{id}: тот же приват, что у бейджей — второе устройство
 * (другая вкладка/телефон) подтягивает свежий список без перезагрузки.
 */
class SavedNotesChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $userId владелец заметок
     * @param string $action created|updated|deleted|cleared
     */
    public function __construct(public int $userId, public string $action = 'updated') {}

    /**
     * Приватный канал владельца.
     *
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    /**
     * Имя события в сокете.
     *
     * @return string
     */
    public function broadcastAs(): string
    {
        return 'saved-notes.changed';
    }

    /**
     * Данные события.
     *
     * @return array<string, string>
     */
    public function broadcastWith(): array
    {
        return ['action' => $this->action];
    }
}
