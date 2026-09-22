<?php

namespace App\Notifications;

use App\Models\Business;

/**
 * Бизнес отклонён модерацией (владельцу, с причиной).
 *
 * Дублирует websocket `business.rejected` для polling/toast fallback.
 */
class BusinessRejectedNotification extends UserNotification
{
    public function __construct(private Business $business) {}

    public function type(): string { return 'business.rejected'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'business-rejected:' . $this->business->id . ':' . $this->business->updated_at?->timestamp; }

    public function payload(string $id): array
    {
        $cabinet = $this->business->toCabinetArray();

        return [
            'activity' => null,
            'business' => [
                'id' => $cabinet['id'] ?? $this->business->id,
                'name' => $cabinet['name'] ?? $this->business->name,
                'verification_status' => 'rejected',
                'verification_notes' => $cabinet['verification_notes'] ?? null,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $reason = mb_substr((string) ($this->business->verification_notes ?? ''), 0, 80);

        return [
            'title' => 'Проверка отклонена',
            'body' => ($this->business->name ?? 'Бизнес') . ($reason !== '' ? ' — ' . $reason : ' — исправьте реквизиты'),
            'url' => '/cabinet/onboarding',
            'tag' => 'business-rejected-' . $this->business->id,
            'avatar' => null,
        ];
    }
}
