<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\User;

/**
 * Приглашение в UDistrict (от владельца, вне зоны тоже видно).
 *
 * Приглашённый сразу становится жителем: район открывается
 * по диплинку /map?district=, даже если вне его домашней зоны.
 */
class DistrictInvitedNotification extends UserNotification
{
    public function __construct(private District $district, private User $inviter) {}

    public function type(): string { return 'district.invited'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'district-invite:'.$this->district->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'interest' => $this->district->interest,
                'conversation_id' => $this->district->conversation_id,
                'inviter' => [
                    'id' => $this->inviter->id,
                    'name' => $this->inviter->name,
                    'avatar_path' => $this->inviter->avatar_path,
                    'avatar_url' => $this->inviter->avatar_url,
                ],
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => '🎫 Вас пригласили в район «'.$this->district->name.'»',
            'body' => ($this->inviter->name ?: 'Владелец').' добавил вас в жители — общий чат открыт',
            'url' => '/map?district='.$this->district->id,
            'tag' => 'district-invite-'.$this->district->id,
            'avatar' => $this->inviter->avatar_url,
        ];
    }
}
