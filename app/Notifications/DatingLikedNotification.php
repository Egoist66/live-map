<?php

namespace App\Notifications;

use App\Models\User;

/**
 * Лайк анкеты в ULove (получателю лайка).
 */
class DatingLikedNotification extends UserNotification
{
    public function __construct(
        private User $liker,
        private int $ownerId,
        private bool $incognito = false,
        private bool $superlike = false,
    ) {}

    public function type(): string { return 'dating.liked'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'dating-liked:'.$this->liker->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'swipe_like', $this->ownerId, [
                'actor_id' => $this->liker->id,
                'related_user_id' => $this->liker->id,
                'is_incognito' => $this->incognito,
                'is_superlike' => $this->superlike,
                'actor' => static::actorShape($this->liker, $this->incognito),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $title = $this->superlike ? '⭐ Тебе отправили суперлайк!' : '💘 Тебя лайкнули в ULove';

        $body = $this->incognito
            ? 'Тайный поклонник отреагировал на твою анкету'
            : ($this->liker->name.' отреагировал на твою анкету');

        if ($this->superlike && ! $this->incognito) {
            $body = $this->liker->name.' выделил(а) тебя суперлайком!';
        }

        return [
            'title' => $title,
            'body' => $body,
            'url' => '/swipes?tab=admirers',
            'tag' => 'dating-liked-'.$this->liker->id,
            'avatar' => $this->incognito ? null : $this->liker->avatar_url,
        ];
    }
}
