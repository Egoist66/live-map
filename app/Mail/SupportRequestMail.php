<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Обращение в поддержку из настроек приложения.
 *
 * Пользователь пишет тему + сообщение прямо в интерфейсе —
 * письмо уходит админам через настроенный SMTP (MAIL_MAILER),
 * а не через mailto-ссылку в почтовом клиенте.
 */
class SupportRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param string $subject тема обращения
     * @param string $message текст обращения
     * @param string $name имя отправителя
     * @param string $email email отправителя для ответа
     */
    public function __construct(
        public string $subject,
        public string $message,
        public string $name,
        public string $email,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "🛟 Поддержка: {$this->subject} — {$this->name} <{$this->email}>",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.support-request',
            with: [
                'subjectText' => $this->subject,
                'messageText' => $this->message,
                'senderName' => $this->name,
                'senderEmail' => $this->email,
            ],
        );
    }
}
