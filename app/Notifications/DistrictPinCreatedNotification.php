<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\Pin;
use App\Models\User;

/**
 * В районе создан пин (всем жителям, кроме автора).
 */
class DistrictPinCreatedNotification extends UserNotification
{
    public function __construct(
        private District $district,
        private Pin $pin,
        private User $actor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'district.pin_created'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string
    {
        return 'district-pin:'.$this->district->id.':'.$this->pin->id;
    }

    public function payload(string $id): array
    {
        $title = (string) $this->pin->title;

        return [
            'activity' => static::activityShape($id, 'district_pin', $this->ownerId, [
                'pin_id' => $this->pin->id,
                'actor_id' => $this->actor->id,
                'excerpt' => static::excerpt($title) ?? $title,
                'pin' => [
                    'id' => $this->pin->id,
                    'title' => $title,
                    'category' => $this->pin->category,
                ],
                'actor' => static::actorShape($this->actor),
            ]),
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'pin_id' => $this->pin->id,
                'pin_title' => $title,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $title = mb_substr((string) $this->pin->title, 0, 60);

        return [
            'title' => 'Новый пин в «'.$this->district->name.'»',
            'body' => $this->actor->name.' — «'.$title.'»',
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-pin-'.$this->pin->id,
            'avatar' => $this->actor->avatar_url,
        ];
    }
}
