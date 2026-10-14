<?php

namespace App\Notifications;

/**
 * Ответ поддержки пользователю (в inbox + тост).
 *
 * Шлётся автору тикета после ответа админа: дублирует письмо,
 * чтобы ответ было видно и в колокольчике. activity нет —
 * строка живёт в секции «Уведомления», а не в лентах видов.
 */
class SupportAnsweredNotification extends UserNotification
{
    /**
     * @param int $ticketId номер обращения
     * @param string $subject тема обращения
     * @param string $reply текст ответа администратора
     */
    public function __construct(
        private int $ticketId,
        private string $subject,
        private string $reply,
    ) {}

    public function type(): string { return 'support.answered'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'ticket:'.$this->ticketId; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'support_answer' => [
                'ticket_id' => $this->ticketId,
                'subject' => $this->subject,
                'reply' => $this->reply,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $preview = mb_substr(trim($this->reply), 0, 80);

        return [
            'title' => "Поддержка ответила: {$this->subject}",
            'body' => $preview,
            'url' => '/settings/support',
            'tag' => 'support-answer-'.$this->ticketId,
            'avatar' => null,
        ];
    }
}
