<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Тред комментариев изменился: создан/правлен/удалён коммент или ответ.
 *
 * Пейлоад намеренно без содержимого (только kind+id): клиенты
 * подтягивают свежий список обычным REST (там же проверки видимости),
 * поэтому событие безопасно слать в публичный канал треда.
 * Сокет — мгновенно, polling — добивкой watch_threads в sync().
 */
class CommentThreadUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param string $kind pin|flow|district|photo
     * @param int $id id пина/поста/новости/фото
     */
    public function __construct(
        public string $kind,
        public int $id,
    ) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel('threads.'.$this->kind.'.'.$this->id)];
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'kind' => $this->kind,
            'id' => $this->id,
        ];
    }

    public function broadcastAs(): string
    {
        return 'thread.updated';
    }

    /**
     * Пнуть тред одной строкой из контроллеров.
     * Ошибки шины глушим: realtime не должен ронять запись коммента.
     *
     * @param string $kind pin|flow|district|photo
     * @param int $id id объекта
     * @return void
     */
    public static function touch(string $kind, int $id): void
    {
        if ($id <= 0 || ! in_array($kind, ['pin', 'flow', 'district', 'photo'], true)) {
            return;
        }

        try {
            broadcast(new self($kind, $id))->toOthers();
        } catch (\Throwable $e) {
            Log::warning('thread broadcast failed', ['kind' => $kind, 'id' => $id, 'error' => $e->getMessage()]);
        }
    }
}
