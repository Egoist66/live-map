<?php

namespace App\Notifications;

use App\Models\DatingReview;

/**
 * Вердикт модерации по твоему отзыву (автору).
 *
 * Одобрен — отзыв теперь виден получателю в профиле и в карточках
 * свайпов; отклонён — опубликован не будет (можно не переживать:
 * голую оценку оставшийся отзыв не портит).
 */
class ReviewModeratedNotification extends UserNotification
{
    public function __construct(private DatingReview $review) {}

    public function type(): string { return 'review.moderated'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'review-moderated:'.$this->review->id.':'.$this->review->status; }

    /**
     * @param string $id uuid создаваемой строки
     * @return array<string, mixed>
     */
    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'review' => $this->review->toNotifyArray(),
        ];
    }

    /**
     * @return array{title:string, body:string, url:string, tag:string, avatar:string|null}|null
     */
    public function pushPayload(): ?array
    {
        $approved = $this->review->status === DatingReview::STATUS_APPROVED;

        return [
            'title' => $approved ? '⭐ Твой отзыв одобрен' : '⭐ Твой отзыв отклонён',
            'body' => $approved
                ? 'Оценка '.(int) $this->review->rating.' из 5 уже видна в профиле получателя'
                : 'Отзыв не прошёл модерацию — он опубликован не будет',
            'url' => '/profile',
            'tag' => 'review-moderated-'.$this->review->id,
            'avatar' => null,
        ];
    }
}
