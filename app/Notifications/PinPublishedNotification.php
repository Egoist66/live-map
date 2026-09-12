<?php

namespace App\Notifications;

use App\Models\Pin;
use App\Models\User;

/**
 * Автор создал пин (подписчикам с флагом notify_pin).
 */
class PinPublishedNotification extends UserNotification
{
    public function __construct(
        private Pin $pin,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'pin.published'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string { return 'pin-published:'.$this->pin->id; }

    public function payload(string $id): array
    {
        $title = (string) $this->pin->title;

        return [
            'activity' => static::activityShape($id, 'sub_pin', $this->ownerId, [
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
            'title' => 'Новый пин',
            'body' => $this->actor->name.' — «'.$title.'»',
            'url' => '/users/'.$this->actor->id,
            'tag' => 'pin-published-'.$this->pin->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
