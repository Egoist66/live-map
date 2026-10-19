<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Код скринлокера сброшен на сервере.
 *
 * Устройство слушает `user.{id}` и по `reset_at` понимает, что локальную
 * запись пора стереть. Метка нужна, чтобы не путать сброс с «активация
 * ещё не дошла»: без неё выключенный локер можно было бы включить обратно
 * устаревшим `is_sl_active=true`.
 */
class ScreenLockReset implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    /**
     * @param int $userId владелец скринлокера
     * @param int $resetAt метка сброса в миллисекундах
     */
    public function __construct(
        public int $userId,
        public int $resetAt,
    ) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('user.'.$this->userId)];
    }

    /**
     * @return string
     */
    public function broadcastAs(): string
    {
        return 'screen-lock.reset';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['reset_at' => $this->resetAt];
    }
}
