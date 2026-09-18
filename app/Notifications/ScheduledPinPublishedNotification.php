<?php

namespace App\Notifications;

use App\Models\Pin;
use App\Models\User;

/**
 * Запланированный пин автора опубликован (наступил publish_at).
 *
 * Получатель — сам автор: колокольчик, realtime-тост и push
 * сообщают, что пин уже виден на карте.
 */
class ScheduledPinPublishedNotification extends UserNotification
{
    public function __construct(
        private Pin $pin,
        private User $actor,
    ) {}

    public function type(): string { return 'pin.scheduled_published'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string { return 'scheduled-pin:'.$this->pin->id; }

    public function payload(string $id): array
    {
        $title = (string) $this->pin->title;

        return [
            'activity' => static::activityShape($id, 'scheduled_published', $this->actor->id, [
                'pin_id' => $this->pin->id,
                'actor_id' => $this->actor->id,
                'excerpt' => static::excerpt($title) ?? $title,
                'pin' => ['id' => $this->pin->id, 'title' => $title, 'category' => $this->pin->category],
                'actor' => static::actorShape($this->actor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $title = mb_substr((string) $this->pin->title, 0, 60);

        return [
            'title' => 'Пин опубликован',
            'body' => 'Ваш запланированный пин «'.$title.'» уже на карте',
            'url' => '/map?pin='.$this->pin->id,
            'tag' => 'scheduled-pin-'.$this->pin->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
