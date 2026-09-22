<?php

namespace App\Notifications;

use App\Models\District;
use App\Models\User;

/**
 * Новая заявка в UDistrict (владельцу района).
 *
 * Организации именуются «Организация», персоны — «Пользователь»
 * (subjectWord по is_organization заявителя). Цель вступления
 * (message) едет в пейлоаде для таба «Заявки» и тоста.
 */
class DistrictJoinRequestedNotification extends UserNotification
{
    public function __construct(
        private District $district,
        private User $requester,
        private ?string $message = null,
    ) {}

    public function type(): string { return 'district.join_requested'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'district-request:'.$this->district->id.':'.$this->requester->id; }

    public function payload(string $id): array
    {
        $requester = static::actorShape($this->requester);

        $message = $this->cleanMessage();

        if ($message !== null) {
            $requester['request_message'] = $message;
        }

        return [
            'activity' => null,
            'district' => [
                'id' => $this->district->id,
                'name' => $this->district->name,
                'interest' => $this->district->interest,
                'requester' => $requester,
                'request_message' => $message,
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $requesterName = $this->requester->name ?: 'Кто-то';
        $subject = static::subjectWord($this->requester);
        $body = $subject.' '.$requesterName.' отправил заявку на вступление в район «'.$this->district->name.'»';
        $message = $this->cleanMessage();

        if ($message !== null) {
            $body .= ' · Цель: '.mb_substr($message, 0, 80);
        }

        return [
            'title' => $subject.' '.$requesterName.' — заявка в район',
            'body' => $body,
            'url' => '/districts/'.$this->district->id,
            'tag' => 'district-request-'.$this->district->id.'-'.$this->requester->id,
            'avatar' => $this->requester->avatar_url,
        ];
    }

    /**
     * Чистая цель вступления (null когда не указана).
     *
     * @return string|null до 500 символов
     */
    private function cleanMessage(): ?string
    {
        $clean = trim((string) ($this->message ?? ''));

        if ($clean === '') {
            return null;
        }

        return mb_substr($clean, 0, 500);
    }
}
