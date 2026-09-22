<?php

namespace App\Notifications;

use App\Models\District;

/**
 * Заявку в UDistrict отклонили (автору заявки).
 *
 * Раньше отказ был тихим (строка просто удалялась) — автор не знал
 * решения. Теперь организатор решает явно: принять, отклонить
 * (с этим уведомлением) или связаться в личке.
 */
class DistrictRequestRejectedNotification extends UserNotification
{
    public function __construct(private District $district) {}

    public function type(): string { return 'district.request_rejected'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'district-rejected:'.$this->district->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'interest' => $this->district->interest,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        return [
            'title' => 'Заявка отклонена',
            'body' => 'Владелец района «'.$this->district->name.'» отклонил заявку — можно написать ему в личку',
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-rejected-'.$this->district->id,
            'avatar' => null,
        ];
    }
}
