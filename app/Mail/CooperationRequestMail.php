<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Заявка на сотрудничество с лендинга (диалог «Писать нам»).
 *
 * Название компании уже извлечено из email отправителя
 * (CooperationController::companyNameFromEmail).
 */
class CooperationRequestMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param string $email email бизнеса-отправителя
     * @param string $company название компании, извлечённое из email
     * @param string|null $message необязательный комментарий бизнеса
     */
    public function __construct(
        public string $email,
        public string $company,
        public ?string $message = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "🤝 Сотрудничество: {$this->company} <{$this->email}>",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.cooperation-request',
            with: [
                'email' => $this->email,
                'company' => $this->company,
                'messageText' => $this->message,
            ],
        );
    }
}
