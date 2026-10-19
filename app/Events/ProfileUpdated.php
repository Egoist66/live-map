<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Профиль пользователя изменился (аватар/имя): чужие offline-кеши
 * обязаны пересчитать собеседника без полного рефетча.
 *
 * Раньше смена аватара долетала только на собственные устройства
 * (`gallery.changed` в канал `user.{владелец}`). У друзей, мэтчей и
 * собеседников закешированная строка диалога хранила старый `avatar_url`
 * до следующего сообщения или полного синка — отсюда «протухшие» аватарки.
 *
 * Событие рассылается fan-out'ом по личным каналам получателей
 * (`user.{id}`), поэтому каждый клиент получает его на своём транспорте:
 * сокет через Echo, polling — зеркалом `profiles` в RealtimeController::sync.
 */
class ProfileUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * @param int[] $recipientIds получатели (их каналы user.{id})
     * @param int $userId чей профиль изменился
     * @param string $name актуальное имя
     * @param string|null $avatarUrl актуальный URL аватара (со свежим ?v=)
     * @param int $version версия изменения (ms epoch / updated_at)
     * @param int $galleryVersion версия галереи владельца (0 когда неизвестна)
     */
    public function __construct(
        public array $recipientIds,
        public int $userId,
        public string $name,
        public ?string $avatarUrl,
        public int $version,
        public int $galleryVersion = 0,
    ) {}

    /**
     * Один приватный канал на каждого получателя.
     *
     * Событие создаётся чанками (ProfileFanout), поэтому каналов
     * заведомо немного — лимит broadcast-провайдера не задеваем.
     *
     * @return array<int, \Illuminate\Broadcasting\PrivateChannel>
     */
    public function broadcastOn(): array
    {
        $channels = [];

        foreach ($this->recipientIds as $id) {
            $recipient = (int) $id;

            if ($recipient > 0 && $recipient !== $this->userId) {
                $channels[] = new PrivateChannel('user.'.$recipient);
            }
        }

        return $channels;
    }

    /**
     * @return array{user_id:int,name:string,avatar_url:?string,version:int,gallery_version:int}
     */
    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->userId,
            'name' => $this->name,
            'avatar_url' => $this->avatarUrl,
            'version' => $this->version,
            'gallery_version' => $this->galleryVersion,
        ];
    }

    public function broadcastAs(): string
    {
        return 'profile.updated';
    }
}
