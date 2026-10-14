<?php

namespace App\Notifications;

/**
 * Обращение в поддержку (администраторам).
 *
 * Пейлоад несёт ключ support — фронт показывает тост
 * (handleNotification → handleSupport) и пишет в колокольчик.
 */
class SupportRequestNotification extends UserNotification
{
    /**
     * @param int $ticketId номер тикета в базе
     * @param string $subject тема обращения
     * @param string $message текст обращения
     * @param string $name имя отправителя
     * @param string $email email отправителя
     */
    public function __construct(
        private int $ticketId,
        private string $subject,
        private string $message,
        private string $name,
        private string $email,
    ) {}

    public function type(): string { return 'support.request'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'ticket:'.$this->ticketId; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'support' => [
                'ticket_id' => $this->ticketId,
                'subject' => $this->subject,
                'message' => $this->message,
                'name' => $this->name,
                'email' => $this->email,
                'created_at' => now()->toISOString(),
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $preview = mb_substr(trim($this->message), 0, 80);

        return [
            'title' => "Поддержка: {$this->subject}",
            'body' => trim("«{$preview}» — {$this->name} ({$this->email})"),
            'url' => '/admin/support',
            'tag' => 'support-'.$this->ticketId,
            'avatar' => null,
        ];
    }
}
