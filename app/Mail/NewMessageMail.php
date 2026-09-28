<?php

namespace App\Mail;

use App\Models\Conversation;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Напоминание: новое сообщение в диалоге.
 *
 * Уходит не чаще раза в час на диалог (кулдаун в DatingEmailNotifier).
 */
class NewMessageMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $sender,
        public User $recipient,
        public Conversation $conversation,
        public string $preview,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "💬 Новое сообщение от {$this->sender->name}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.new-message',
            with: [
                'sender' => $this->sender,
                'recipient' => $this->recipient,
                'conversation' => $this->conversation,
                'preview' => $this->preview,
            ],
        );
    }
}
