<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Письмо автору удалённого модератором отзыва ULove.
 *
 * Уважительный и объяснительный тон: что удалено, за что была
 * оценка и почему — с текстом объяснения от персонала. Модель
 * отзыва не сериализуем (отзыв уже удалён), поэтому в конструктор
 * приходят обезличенные скаляры, а не DatingReview.
 */
class ReviewDeletedMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param User $author автор удалённого отзыва
     * @param int $reviewId id удалённого отзыва
     * @param int $rating звёзды удалённой оценки 1–5
     * @param string|null $excerpt короткий текст отзыва (до 120 символов)
     * @param string $reason объяснение от модератора
     */
    public function __construct(
        public User $author,
        public int $reviewId,
        public int $rating,
        public ?string $excerpt,
        public string $reason,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: '⭐ Твой отзыв ULove удалён — объяснение от модерации',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.review-deleted',
            with: [
                'author' => $this->author,
                'reviewId' => $this->reviewId,
                'rating' => $this->rating,
                'excerpt' => $this->excerpt,
                'reason' => $this->reason,
            ],
        );
    }
}
