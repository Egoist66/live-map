<?php

namespace App\Notifications;

use App\Models\DatingReview;

/**
 * Отзыв удалён модератором (автору отзыва).
 *
 * Персонал (админ/модератор) удалил чужой отзыв: автор получает
 * понятное объяснение почему — оно приходит в колокольчик, в
 * push и письмом на почту. Голая строка «удалено» без причины
 * даёт ощущение произвола, поэтому reason обязателен.
 */
class ReviewDeletedNotification extends UserNotification
{
    public function __construct(
        private readonly DatingReview $review,
        private readonly string $reason,
    ) {}

    public function type(): string { return 'review.deleted'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'review-deleted:'.$this->review->id; }

    /**
     * @param string $id uuid создаваемой строки
     * @return array<string, mixed>
     */
    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'review' => $this->review->toNotifyArray(),
            'reason' => $this->reason,
        ];
    }

    /**
     * @return array{title:string, body:string, url:string, tag:string, avatar:string|null}|null
     */
    public function pushPayload(): ?array
    {
        $reasonPreview = mb_substr($this->reason, 0, 90);

        return [
            'title' => '⭐ Твой отзыв удалён модератором',
            'body' => 'Причина: '.$reasonPreview,
            'url' => '/profile',
            'tag' => 'review-deleted-'.$this->review->id,
            'avatar' => null,
        ];
    }
}
