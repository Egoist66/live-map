<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Диалоги убраны у себя (удаление/очистка всего списка).
 *
 * Шлётся в личный канал (user.{id}): другие устройства/вкладки точечно
 * выкидывают id из списка и offline-кеша без полного рефетча.
 * Отправителю событие не возвращается (toOthers + X-Socket-ID) —
 * у него список уже обновлён оптимистикой. Polling-транспорт зеркалит
 * то же через conversations_removed в RealtimeController::sync.
 */
class ConversationRemoved implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int $userId владелец списка
     * @param int[] $ids убранные id диалогов
     */
    public function __construct(public int $userId, public array $ids) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    /**
     * @return array{ids:int[]}
     */
    public function broadcastWith(): array
    {
        $ids = array_values(array_unique(array_map('intval', $this->ids)));

        return ['ids' => array_values(array_filter($ids, fn ($id) => $id > 0))];
    }

    public function broadcastAs(): string { return 'conversation.removed'; }
}
