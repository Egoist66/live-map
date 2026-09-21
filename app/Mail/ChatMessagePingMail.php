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
 * Пинг на email: пока тебя не было онлайн, пришло новое сообщение.
 *
 * Отправляется владельцу включённого автоответа, когда кому-то
 * ушёл его автоматический ответ.
 */
class ChatMessagePingMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $recipient,
        public User $sender,
        public Conversation $conversation,
        public string $preview,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "💬 Новое сообщение от {$this->sender->name} — отправлен автоответ",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.chat-message-ping',
            with: [
                'recipient' => $this->recipient,
                'sender' => $this->sender,
                'conversation' => $this->conversation,
                'preview' => $this->preview,
            ],
        );
    }
}
