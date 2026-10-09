<?php

namespace App\Notifications;

use App\Models\DatingReview;
use App\Models\User;

/**
 * Новый отзыв о тебе в ULove (получателю оценки).
 *
 * Шлём только на создание: правка оценки строку обновляет,
 * а не плодит уведомления. Скрывшие рейтинг отзывов не получают
 * вовсе — им и поставить нельзя (см. DatingReviewService).
 */
class DatingReviewedNotification extends UserNotification
{
    public function __construct(
        private User $author,
        private int $ownerId,
        private DatingReview $review,
    ) {}

    public function type(): string { return 'dating.reviewed'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'dating-reviewed:'.$this->author->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => static::activityShape($id, 'review', $this->ownerId, [
                'actor_id' => $this->author->id,
                'related_user_id' => $this->author->id,
                'rating' => (int) $this->review->rating,
                'excerpt' => static::excerpt($this->review->body),
                'actor' => static::actorShape($this->author),
            ]),
        ];
    }

    public function pushPayload(): ?array
    {
        $rating = (int) $this->review->rating;

        return [
            'title' => '⭐ Новый отзыв о тебе',
            'body' => ($this->author->name.' оценил(а) тебя на '.$rating.' из 5'),
            'url' => '/profile',
            'tag' => 'dating-reviewed-'.$this->author->id,
            'avatar' => $this->author->avatar_url,
        ];
    }
}
