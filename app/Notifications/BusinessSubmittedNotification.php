<?php

namespace App\Notifications;

use App\Models\Business;

/**
 * Новая заявка бизнеса на проверку (staff: админы + модераторы).
 *
 * Дублирует websocket-событие `business.verification.submitted`
 * для polling-режима и колокольчика: inbox-строка непрочитанная,
 * поэтому RealtimeController::sync подхватит её в тике.
 */
class BusinessSubmittedNotification extends UserNotification
{
    public function __construct(private Business $business) {}

    public function type(): string { return 'business.submitted'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'business-sub:' . $this->business->id . ':' . $this->business->updated_at?->timestamp; }

    public function payload(string $id): array
    {
        $cabinet = $this->business->toCabinetArray();

        return [
            'activity' => null,
            'business' => [
                'id' => $cabinet['id'] ?? $this->business->id,
                'name' => $cabinet['name'] ?? $this->business->name,
                'unp' => $cabinet['unp'] ?? null,
                'legal_form' => $cabinet['legal_form'] ?? null,
                'verification_status' => 'pending',
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Новая заявка бизнеса',
            'body' => ($this->business->name ?? 'Компания') . ' — проверка по УНП',
            'url' => '/admin?tab=business',
            'tag' => 'business-sub-' . $this->business->id,
            'avatar' => null,
        ];
    }
}
