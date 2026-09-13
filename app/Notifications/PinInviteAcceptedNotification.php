<?php

namespace App\Notifications;

use App\Models\Pin;
use App\Models\User;

/**
 * Приглашённый принял приглашение в пин (автору пина).
 *
 * Автор видит кто принял и открывает пин одним тапом.
 */
class PinInviteAcceptedNotification extends UserNotification
{
    public function __construct(
        private Pin $pin,
        private User $accepter,
        private int $ownerId,
    ) {}

    public function type(): string { return 'pin.invite_accepted'; }

    public function category(): string { return 'pin'; }

    public function dedupeKey(): ?string { return 'pin-invite-accepted:'.$this->pin->id.':'.$this->accepter->id; }

    /**
     * Пейлоад inbox-строки.
     *
     * @param string $id uuid создаваемой строки
     * @return array{activity: array}
     */
    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'invite_accepted', $this->ownerId, [
                'pin_id' => $this->pin->id,
                'actor_id' => $this->accepter->id,
                'pin' => ['id' => $this->pin->id, 'title' => $this->pin->title, 'category' => $this->pin->category],
                'actor' => static::actorShape($this->accepter),
            ]),
        ];
    }

    /**
     * Системный web-push для автора пина.
     *
     * @return array{title:string,body:string,url:string,tag:string,avatar:string|null}
     */
    public function pushPayload(): ?array
    {
        $name = $this->accepter->name ?: 'Кто-то';
        $title = mb_strimwidth($this->pin->title ?: 'Пин', 0, 40, '…');

        return [
            'title' => '✅ Приглашение принято',
            'body' => "{$name} принял приглашение: «{$title}»",
            'url' => '/map?pin='.$this->pin->id,
            'tag' => "pin-{$this->pin->id}-invite-accepted-{$this->accepter->id}",
            'avatar' => $this->accepter->avatar_url,
        ];
    }
}
