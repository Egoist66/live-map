<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Ответ поддержки пользователю на его обращение.
 *
 * Шлётся на email из тикета (SupportTicket::email): тема исходного
 * обращения + текст ответа админа + цитата вопроса. Одно письмо —
 * строго получателю, без копий админам.
 */
class SupportReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param int $ticketId номер обращения
     * @param string $topic тема исходного обращения
     * @param string $reply текст ответа администратора
     * @param string $senderName имя получателя
     * @param string $question исходный вопрос (цитата)
     */
    public function __construct(
        public int $ticketId,
        public string $topic,
        public string $reply,
        public string $senderName,
        public string $question,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "💬 Ответ поддержки: {$this->topic} (обращение #{$this->ticketId})",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.support-reply',
            with: [
                'ticketId' => $this->ticketId,
                'subjectText' => $this->topic,
                'replyText' => $this->reply,
                'senderName' => $this->senderName,
                'questionText' => $this->question,
            ],
        );
    }
}
