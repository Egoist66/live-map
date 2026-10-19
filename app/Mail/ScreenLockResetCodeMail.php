<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Код подтверждения сброса скринлокера.
 *
 * Отправляется, когда пользователь забыл PIN/пароль блокировки и просит
 * стереть локальный код. Код действует ограниченное время и не даёт
 * доступа к аккаунту — только к сбросу настройки устройства.
 */
class ScreenLockResetCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param string $code 6-значный код
     * @param int $ttlMinutes сколько минут действует код
     */
    public function __construct(
        public string $code,
        public int $ttlMinutes = 10,
    ) {}

    /**
     * @return Envelope
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Сброс скринлокера ULove: {$this->code}",
        );
    }

    /**
     * @return Content
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.screen-lock-reset-code',
            with: [
                'code' => $this->code,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }
}
