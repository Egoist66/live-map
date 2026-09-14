<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\User;

/**
 * Новая заявка в UDistrict (владельцу района).
 */
class DistrictJoinRequestedNotification extends UserNotification
{
    public function __construct(private District $district, private User $requester) {}

    public function type(): string { return 'district.join_requested'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'district-request:'.$this->district->id.':'.$this->requester->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'interest' => $this->district->interest,
                'requester' => [
                    'id' => $this->requester->id,
                    'name' => $this->requester->name,
                    'avatar_path' => $this->requester->avatar_path,
                    'avatar_url' => $this->requester->avatar_url,
                ],
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Заявка в район «'.$this->district->name.'»',
            'body' => ($this->requester->name ?: 'Кто-то').' хочет жить в вашем районе',
            'url' => '/map?district='.$this->district->id,
            'tag' => 'district-request-'.$this->district->id.'-'.$this->requester->id,
            'avatar' => $this->requester->avatar_url,
        ];
    }
}
