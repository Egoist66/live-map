<?php

namespace App\Notifications;

use App\Models\UserDevice;

/**
 * Вход в аккаунт с нового (неизвестного) устройства.
 *
 * Лежит в табе «События» колокольчика + уходит системным web-push
 * (pushPayload) и дублем в Telegram (шлёт LoginDeviceGuard напрямую,
 * минуя гейт онлайна — безопасностный алерт важен всегда).
 */
class SecurityNewDeviceNotification extends UserNotification
{
    public function __construct(private UserDevice $device) {}

    public function type(): string { return 'security.new_device'; }

    public function category(): string { return 'event'; }

    public function dedupeKey(): ?string { return 'new-device:'.$this->device->id; }

    public function payload(string $id): array
    {
        return [
            'activity' => null,
            'new_device' => [
                'device_id' => $this->device->id,
                'ip' => $this->device->ip,
                'country' => $this->device->country,
                'city' => $this->device->city,
                'device' => $this->device->device,
                'platform' => $this->device->platform,
                'browser' => $this->device->browser,
                'client' => $this->device->client,
                'device_label' => $this->device->label(),
                'seen_at' => $this->device->last_seen_at?->toISOString(),
            ],
        ];
    }

    public function pushPayload(): ?array
    {
        $place = trim(implode(' · ', array_filter([
            $this->device->city,
            $this->device->country,
            $this->device->ip,
        ])));

        $body = $this->device->label().($place !== '' ? ' · '.$place : '');

        return [
            'title' => '🔐 Вход с нового устройства',
            'body' => $body !== '' ? $body : 'Кто-то зашёл в ваш аккаунт',
            'url' => '/settings',
            'tag' => 'sec-new-device-'.$this->device->id,
            'avatar' => null,
        ];
    }
}
