<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Гость профиля: кто-то открыл страницу пользователя.
 *
 * Только для PRO и выше (гейт — canUseVisitorNotifications) и только
 * при включённом тумблере notify_profile_visitors. Одна строка на гостя:
 * повторный визит в течение суток поднимает запись, а не плодит дубли.
 */
class ProfileVisitedNotification extends UserNotification
{
    public function __construct(
        private User $visitor,
        private int $ownerId,
    ) {}

    public function type(): string { return 'profile.visited'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'profile-visited:'.$this->visitor->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'profile_visit', $this->ownerId, [
                'actor_id' => $this->visitor->id,
                'related_user_id' => $this->visitor->id,
                'actor' => static::actorShape($this->visitor),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => '👀 Гость в профиле',
            'body' => $this->visitor->name.' заходил(а) в ваш профиль',
            'url' => '/users/'.$this->visitor->profileIdentifier(),
            'tag' => 'profile-visited-'.$this->visitor->id,
            'avatar' => $this->visitor->avatar_url,
        ];
    }
}
