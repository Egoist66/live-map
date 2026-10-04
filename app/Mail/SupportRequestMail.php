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
     * NB: имена свойств не должны совпадать с public $subject в базовом Mailable
     * (PHP требует omit типа у переопределения) и с $message в blade-вьюхах писем,
     * поэтому используем topic/body/senderName/senderEmail.
     *
     * @param string $topic тема обращения
     * @param string $body текст обращения
     * @param string $senderName имя отправителя
     * @param string $senderEmail email отправителя для ответа
     */
    public function __construct(
        public string $topic,
        public string $body,
        public string $senderName,
        public string $senderEmail,
    ) {}

    public function envelope(): Envelope
    {
        $envelopeSubject = "🛟 Поддержка: {$this->topic} — {$this->senderName} <{$this->senderEmail}>";

        return new Envelope(
            subject: $envelopeSubject,
        );
    }

    public function content(): Content
    {
        $viewData = [
            'subjectText' => $this->topic,
            'messageText' => $this->body,
            'senderName' => $this->senderName,
            'senderEmail' => $this->senderEmail,
        ];

        return new Content(
            view: 'emails.support-request',
            with: $viewData,
        );
    }
}
