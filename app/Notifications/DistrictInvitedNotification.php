<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\User;

/**
 * Приглашение в UDistrict (от владельца, вне зоны тоже видно).
 *
 * Это именно приглашение: житель добавляется только после кнопки
 * «Принять» в уведомлениях или карточке района. «Отклонить» тихо
 * удаляет приглашение, владельца не спамим (как инвайты в пины).
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
                'inviter' => static::actorShape($this->inviter),
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => '🎫 Вас пригласили в район «'.$this->district->name.'»',
            'body' => ($this->inviter->name ?: 'Владелец').' зовёт в жители — примите или отклоните',
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-invite-'.$this->district->id,
            'avatar' => $this->inviter->avatar_url,
        ];
    }
}
