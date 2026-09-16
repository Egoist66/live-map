<?php

namespace App\Notifications;

use App\Models\District;

/**
 * Заявку в UDistrict одобрили (автору заявки).
 */
class DistrictRequestApprovedNotification extends UserNotification
{
    public function __construct(private District $district) {}

    public function type(): string { return 'district.request_approved'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'district-approved:'.$this->district->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'interest' => $this->district->interest,
                'conversation_id' => $this->district->conversation_id,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Вы в районе «'.$this->district->name.'»',
            'body' => 'Владелец одобрил заявку — пины района и общий чат открыты',
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-approved-'.$this->district->id,
            'avatar' => null,
        ];
    }
}
