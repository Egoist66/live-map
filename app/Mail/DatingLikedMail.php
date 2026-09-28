<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Напоминание: вашу анкету лайкнули в ULove.
 *
 * Инкогнито-лайк не раскрывает автора и в письме.
 */
class DatingLikedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $liker,
        public User $liked,
        public bool $isIncognito = false,
        public bool $isSuperlike = false,
    ) {}

    public function envelope(): Envelope
    {
        $subject = $this->isSuperlike
            ? '⭐ Вас суперлайкнули — загляните, кто это!'
            : '💖 Вас лайкнули — загляните, кто это!';

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.dating-liked',
            with: [
                'liker' => $this->liker,
                'liked' => $this->liked,
                'isIncognito' => $this->isIncognito,
                'isSuperlike' => $this->isSuperlike,
            ],
        );
    }
}
