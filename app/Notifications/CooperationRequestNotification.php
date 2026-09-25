<?php

namespace App\Notifications;

/**
 * Заявка на сотрудничество (администраторам).
 *
 * Пейлоад несёт ключ cooperation — фронт показывает тост
 * (handleNotification → handleCooperation) и пишет в колокольчик.
 */
class CooperationRequestNotification extends UserNotification
{
    /**
     * @param string $email email бизнеса-отправителя
     * @param string $company название компании, извлечённое из email
     * @param string|null $message необязательный комментарий бизнеса
     */
    public function __construct(
        private string $email,
        private string $company,
        private ?string $message = null,
    ) {}

    public function type(): string { return 'cooperation.request'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return null; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'cooperation' => [
                'email' => $this->email,
                'company' => $this->company,
                'message' => $this->message,
                'created_at' => now()->toISOString(),
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => "Сотрудничество: {$this->company}",
            'body' => trim(($this->message ? "«{$this->message}» — " : '').$this->email),
            'url' => '/admin',
            'tag' => 'cooperation-'.md5($this->email.$this->company),
            'avatar' => null,
        ];
    }
}
