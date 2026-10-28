<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Inbox пользователя изменился на другом устройстве/вкладке.
 *
 * Прочтение и очистка уведомлений раньше жили только в ответе API:
 * в socket-режиме соседняя вкладка узнавала об этом лишь по минутному
 * сторожу бейджей. Событие будит её сразу — колокольчик и счётчики
 * перечитывают серверную правду без ожидания.
 */
class NotificationInboxChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param  int  $ownerId  владелец inbox
     * @param  bool  $all  погашена вся лента (или весь таб)
     * @param  string|null  $category  таб (pin/event) при массовом изменении
     * @param  string[]  $ids  конкретные строки при точечном прочтении
     */
    public function __construct(
        public int $ownerId,
        public bool $all = false,
        public ?string $category = null,
        public array $ids = [],
    ) {}

    /**
     * Разослать событие всем вкладкам владельца, кроме инициатора.
     *
     * @param  int  $ownerId  владелец inbox
     * @param  bool  $all  погашена вся лента
     * @param  string|null  $category  таб массового изменения
     * @param  string[]  $ids  конкретные строки
     */
    public static function dispatchFor(int $ownerId, bool $all = false, ?string $category = null, array $ids = []): void
    {
        try {
            broadcast(new self($ownerId, $all, $category, $ids))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('notification inbox broadcast failed', [
                'user_id' => $ownerId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.'.$this->ownerId),
        ];
    }

    public function broadcastAs(): string
    {
        return 'notification.inbox-changed';
    }

    /**
     * @return array{all:bool,category:string|null,ids:string[]}
     */
    public function broadcastWith(): array
    {
        return [
            'all' => $this->all,
            'category' => $this->category,
            'ids' => $this->ids,
        ];
    }
}
