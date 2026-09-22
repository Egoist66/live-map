<?php

namespace App\Events;

use App\Models\Business;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Бизнес отправил документы на проверку — уведомить админов и модераторов.
 *
 * Канал: private `user.{staffId}` для каждого staff (is_admin / role admin|moderator).
 * Фронт staff слушает `.business.verification.submitted` через Echo,
 * дублирует inbox-уведомлением (UserNotifier) для polling-режима.
 */
class BusinessVerificationSubmitted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public Business $business) {}

    /**
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $staffIds = \App\Models\User::where('is_admin', true)
            ->orWhere('role', 'admin')
            ->orWhere('role', 'moderator')
            ->pluck('id')
            ->all();

        $adminIds = $staffIds;

        $channels = [];

        foreach ($adminIds as $adminId) {
            $channels[] = new PrivateChannel('user.' . $adminId);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'business.verification.submitted';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return ['business' => $this->business->toCabinetArray()];
    }
}
