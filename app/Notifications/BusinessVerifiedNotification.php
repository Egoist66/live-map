<?php

namespace App\Notifications;

use App\Models\Business;

/**
 * Бизнес прошёл проверку (владельцу).
 *
 * Дублирует websocket `business.verified` для polling/toast fallback.
 */
class BusinessVerifiedNotification extends UserNotification
{
    public function __construct(private Business $business) {}

    public function type(): string { return 'business.verified'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'business-verified:' . $this->business->id; }

    public function payload(string $id): array
    {
        $cabinet = $this->business->toCabinetArray();

        return [
            'activity' => null,
            'business' => [
                'id' => $cabinet['id'] ?? $this->business->id,
                'name' => $cabinet['name'] ?? $this->business->name,
                'verification_status' => 'verified',
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Компания проверена',
            'body' => ($this->business->name ?? 'Бизнес') . ' — бейдж «Проверено» включён',
            'url' => '/cabinet',
            'tag' => 'business-verified-' . $this->business->id,
            'avatar' => null,
        ];
    }
}
