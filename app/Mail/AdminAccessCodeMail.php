<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Одноразовый код для входа в панель модерации.
 */
class AdminAccessCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param string $code 6 цифр
     * @param int $ttlMinutes сколько минут живёт код
     */
    public function __construct(
        public string $code,
        public int $ttlMinutes = 10,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "🔐 Код для панели модерации: {$this->code}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.admin-access-code',
            with: [
                'code' => $this->code,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }
}
