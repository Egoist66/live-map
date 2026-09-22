<?php

namespace App\Notifications;

use App\Models\Friendship;

/**
 * Заявка в друзья принята (автору заявки).
 */
class FriendAcceptedNotification extends UserNotification
{
    public function __construct(private Friendship $friendship) {}

    public function type(): string { return 'friend.accepted'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'friend-accept:'.$this->friendship->id; }

    public function payload(string $id): array
    {
        $f = $this->friendship;

        return [
            'activity' => null,
            'friendship' => [
                'id' => $f->id,
                'requester_id' => $f->requester_id,
                'addressee_id' => $f->addressee_id,
                'status' => $f->status,
                'requester' => $f->requester ? static::actorShape($f->requester) : null,
                'addressee' => $f->addressee ? static::actorShape($f->addressee) : null,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $addressee = $this->friendship->addressee;
        $name = $addressee?->name;

        if ($name) {
            $verb = static::subjectWord($addressee) === 'Организация' ? 'приняла заявку' : 'принял заявку';
            $body = $name.' '.$verb;
        } else {
            $body = 'Пользователь принял заявку';
        }

        return [
            'title' => 'Заявка принята',
            'body' => $body,
            'url' => '/chat?tab=friends',
            'tag' => 'friend-accepted-'.($addressee?->id ?? $this->friendship->id),
            'avatar' => $addressee?->avatar_url,
        ];
    }
}
