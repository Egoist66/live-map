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
                'requester' => $f->requester ? [
                    'id' => $f->requester->id,
                    'name' => $f->requester->name,
                    'avatar_path' => $f->requester->avatar_path,
                    'avatar_url' => $f->requester->avatar_url,
                ] : null,
                'addressee' => $f->addressee ? [
                    'id' => $f->addressee->id,
                    'name' => $f->addressee->name,
                    'avatar_path' => $f->addressee->avatar_path,
                    'avatar_url' => $f->addressee->avatar_url,
                ] : null,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $addressee = $this->friendship->addressee;

        return [
            'title' => 'Заявка принята',
            'body' => ($addressee?->name ?: 'Пользователь').' принял заявку',
            'url' => '/chat?tab=friends',
            'tag' => 'friend-accepted-'.($addressee?->id ?? $this->friendship->id),
            'avatar' => $addressee?->avatar_url,
        ];
    }
}
