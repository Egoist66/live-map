<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Напоминание: новый взаимный мэтч в ULove.
 *
 * Письмо уходит пассивной стороне — актор и так видит сплэш мэтча.
 */
class DatingMatchedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $actor,
        public User $other,
        public int $matchId,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "💞 Новый мэтч с {$this->actor->name} — напишите друг другу!",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.dating-matched',
            with: [
                'actor' => $this->actor,
                'other' => $this->other,
                'matchId' => $this->matchId,
            ],
        );
    }
}
