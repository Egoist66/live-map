<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Письмо команде проекта: на платформе появился новый пользователь.
 *
 * Отправляется админам через `AdminNotifier::newUserRegistered()`
 * как при обычной веб-регистрации, так и при автосоздании аккаунта
 * из Telegram-входа.
 */
class NewUserRegisteredMail extends Mailable
{
    use Queueable, SerializesModels;

    /**
     * @param string $userName имя нового пользователя
     * @param string $userEmail email нового пользователя
     * @param string $accountType тип аккаунта: person|business
     * @param string $signupGoal цель захода с формы регистрации
     * @param string $channel источник регистрации: web|telegram
     * @param string|null $registeredAt ISO-время регистрации
     * @param string|null $telegramUsername username в Telegram (если привязан)
     */
    public function __construct(
        public string $userName,
        public string $userEmail,
        public string $accountType = 'person',
        public string $signupGoal = '',
        public string $channel = 'web',
        public ?string $registeredAt = null,
        public ?string $telegramUsername = null,
    ) {}

    /**
     * Тема письма: имя и email сразу видны в списке входящих.
     *
     * @return Envelope
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "🆕 Новый пользователь: {$this->userName} <{$this->userEmail}>",
        );
    }

    /**
     * Содержимое письма: карточка регистрации новичка.
     *
     * @return Content
     */
    public function content(): Content
    {
        $accountTypeLabel = $this->accountType === 'business' ? 'Компания' : 'Персона';
        $channelLabel = $this->channel === 'telegram' ? 'Telegram' : 'Сайт';

        return new Content(
            view: 'emails.new-user-registered',
            with: [
                'userName' => $this->userName,
                'userEmail' => $this->userEmail,
                'accountTypeLabel' => $accountTypeLabel,
                'signupGoal' => $this->signupGoal,
                'channelLabel' => $channelLabel,
                'registeredAt' => $this->registeredAt,
                'telegramUsername' => $this->telegramUsername,
            ],
        );
    }
}
