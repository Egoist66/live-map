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
                'accepter' => static::actorShape($this->accepter),
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $subject = static::subjectWord($this->accepter);
        $name = $this->accepter->name ?: 'Новый житель';
        $verb = $subject === 'Организация' ? 'приняла приглашение' : 'принял приглашение';

        return [
            'title' => '✅ '.$name.' '.$verb,
            'body' => 'Район «'.$this->district->name.'»: открыт доступ к пинам и чату',
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-invite-accepted-'.$this->district->id,
            'avatar' => $this->accepter->avatar_url,
        ];
    }
}
