<?php

namespace App\Notifications;

use App\Models\DatingReview;

/**
 * Новый отзыв в очереди модерации (админам и модераторам).
 *
 * Шлём при постановке отзыва в pending: персонал открывает раздел
 * «Отзывы» в админке и одабривает или отклоняет. Пейлоад data.review
 * несёт всё для карточки решения без повторного запроса.
 */
class ReviewPendingNotification extends UserNotification
{
    public function __construct(private DatingReview $review) {}

    public function type(): string { return 'review.created'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'review-pending:'.$this->review->id.':'.$this->review->updated_at?->timestamp; }

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
        $targetName = (string) ($this->review->target->name ?? $this->review->target_id);

        return [
            'title' => '⭐ Отзыв #'.$this->review->id.' ждёт модерации',
            'body' => ($this->review->author->name ?? 'Пользователь').' → '.$targetName.' · '.(int) $this->review->rating.' ★',
            'url' => '/admin/admin',
            'tag' => 'review-pending-'.$this->review->id,
            'avatar' => $this->review->author->avatar_url ?? null,
        ];
    }
}
