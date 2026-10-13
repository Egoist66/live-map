<?php

namespace App\Events;

use App\Models\BotBroadcast;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Рассылка админа в боте завершена: живая статистика автору.
 *
 * Уходит в личку админа-автора (private user.*) сразу по окончании
 * фоновой задачи — открытая админка подхватывает событие с шины
 * и обновляет таблицу без ручного рефреша. Обычным пользователям
 * ничего не шлём: их уведомление — само сообщение в боте.
 */
class BotBroadcastFinished implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public BotBroadcast $broadcast) {}

    /**
     * Каналы доставки: только админ-автор.
     *
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        $adminId = (int) ($this->broadcast->created_by ?? 0);

        if ($adminId <= 0) {
            return [];
        }

        return [new PrivateChannel('user.'.$adminId)];
    }

    /**
     * Имя события на шине (совпадает с USER_EVENTS на фронте).
     *
     * @return string
     */
    public function broadcastAs(): string
    {
        return 'bot-broadcast.finished';
    }

    /**
     * Полезная нагрузка: итоги доставки и голосов.
     *
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        $broadcast = $this->broadcast;

        return ['broadcast' => [
            'id' => (int) $broadcast->id,
            'type' => (string) $broadcast->type,
            'title' => (string) $broadcast->title,
            'status' => (string) $broadcast->status,
            'sent_count' => (int) $broadcast->sent_count,
            'failed_count' => (int) $broadcast->failed_count,
            'votes_count' => (int) $broadcast->votes_count,
        ]];
    }
}
