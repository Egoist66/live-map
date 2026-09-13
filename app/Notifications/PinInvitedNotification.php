<?php

namespace App\Notifications;

use App\Models\Pin;
use App\Models\User;

/**
 * Приглашение посмотреть чужой пин вне зоны/страны.
 *
 * Приглашённый видит пин на карте особым маркером и может
 * открывать его и комментировать как обычный пин.
 */
class PinInvitedNotification extends UserNotification
{
    public function __construct(
        private Pin $pin,
        private User $inviter,
        private int $inviteeId,
        private ?int $inviteId = null,
    ) {}

    public function type(): string { return 'pin.invited'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string { return 'pin-invite:'.$this->pin->id.':'.$this->inviteeId; }

    /**
     * Пейлоад inbox-строки.
     *
     * @param string $id uuid создаваемой строки
     * @return array{activity: array}
     */
    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'invite', $this->inviteeId, [
                'pin_id' => $this->pin->id,
                'actor_id' => $this->inviter->id,
                'invite_id' => $this->inviteId,
                'pin' => ['id' => $this->pin->id, 'title' => $this->pin->title, 'category' => $this->pin->category],
                'actor' => static::actorShape($this->inviter),
            ]),
        ];
    }

    /**
     * Системный web-push для приглашённого.
     *
     * @return array{title:string,body:string,url:string,tag:string,avatar:string|null}
     */
    public function pushPayload(): ?array
    {
        $name = $this->inviter->name ?: 'Кто-то';
        $title = mb_strimwidth($this->pin->title ?: 'Пин', 0, 40, '…');

        return [
            'title' => '🎫 Вас пригласили в пин',
            'body' => "{$name} приглашает: «{$title}»",
            'url' => '/map?pin='.$this->pin->id,
            'tag' => "pin-{$this->pin->id}-invite-{$this->inviteeId}",
            'avatar' => $this->inviter->avatar_url,
        ];
    }
}
