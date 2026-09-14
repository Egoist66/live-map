<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\User;

/**
 * Приглашение в UDistrict принято (владельцу района).
 *
 * Приглашённый сам нажал «Принять»: он уже житель и в общем чате.
 */
class DistrictInviteAcceptedNotification extends UserNotification
{
    public function __construct(private District $district, private User $accepter) {}

    public function type(): string { return 'district.invite_accepted'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'district-invite-accepted:'.$this->district->id.':'.$this->accepter->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'interest' => $this->district->interest,
                'conversation_id' => $this->district->conversation_id,
                'accepter' => [
                    'id' => $this->accepter->id,
                    'name' => $this->accepter->name,
                    'avatar_path' => $this->accepter->avatar_path,
                    'avatar_url' => $this->accepter->avatar_url,
                ],
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => '✅ '.($this->accepter->name ?: 'Новый житель').' принял приглашение',
            'body' => 'Район «'.$this->district->name.'»: открыт доступ к пинам и чату',
            'url' => '/map?district='.$this->district->id,
            'tag' => 'district-invite-accepted-'.$this->district->id,
            'avatar' => $this->accepter->avatar_url,
        ];
    }
}
