<?php

namespace App\Notifications;

use App\Models\Friendship;

/**
 * Заявка в друзья (получателю заявки).
 */
class FriendRequestedNotification extends UserNotification
{
    public function __construct(private Friendship $friendship) {}

    public function type(): string { return 'friend.requested'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'friend-request:'.$this->friendship->id; }

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
        $requester = $this->friendship->requester;

        return [
            'title' => 'Заявка в друзья',
            'body' => ($requester?->name ?: 'Кто-то').' хочет дружить',
            'url' => '/chat?tab=requests',
            'tag' => 'friend-request-'.($requester?->id ?? $this->friendship->id),
            'avatar' => $requester?->avatar_url,
        ];
    }
}
