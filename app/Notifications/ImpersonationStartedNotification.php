<?php

namespace App\Notifications;

use App\Models\AdminImpersonationLog;

/**
 * Вход администрации в аккаунт (цели входа, по санкции).
 */
class ImpersonationStartedNotification extends UserNotification
{
    public function __construct(private AdminImpersonationLog $log) {}

    public function type(): string { return 'security.impersonation'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'imp:'.$this->log->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'log' => [
                'id' => $this->log->id,
                'reason' => $this->log->reason,
                'started_at' => $this->log->started_at?->toISOString(),
            ],
        ];
    }
}
