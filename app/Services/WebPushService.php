<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class WebPushService
{
    public function isConfigured(): bool
    {
        return (bool) config('services.webpush.vapid.public_key')
            && (bool) config('services.webpush.vapid.private_key')
            && class_exists(\Minishlink\WebPush\WebPush::class);
    }

    public function sendToUser(User $user, array $payload): int
    {
        return $this->sendToSubscriptions($user->pushSubscriptions()->get(), $payload);
    }

    public function sendChatMessage(User $recipient, User $sender, int $conversationId, string $body): int
    {
        $preview = trim(preg_replace('/\s+/', ' ', $body) ?? '');
        if (mb_strlen($preview) > 120) {
            $preview = mb_substr($preview, 0, 117).'...';
        }
        return $this->sendToUser($recipient, [
            'title' => $sender->name ?: 'Новое сообщение',
            'body' => $preview !== '' ? $preview : 'Новое сообщение',
            'url' => '/chat/'.$conversationId,
            'tag' => 'chat-'.$conversationId,
            'avatar' => $sender->avatar_url,
        ]);
    }

    public function sendFriendRequest(User $recipient, User $requester): int
    {
        return $this->sendToUser($recipient, [
            'title' => 'Заявка в друзья',
            'body' => ($requester->name ?: 'Кто-то').' хочет дружить',
            'url' => '/chat?tab=requests',
            'tag' => 'friend-request-'.$requester->id,
            'avatar' => $requester->avatar_url,
        ]);
    }

    public function sendFriendAccepted(User $recipient, User $addressee): int
    {
        return $this->sendToUser($recipient, [
            'title' => 'Заявка принята',
            'body' => ($addressee->name ?: 'Пользователь').' принял заявку',
            'url' => '/chat?tab=friends',
            'tag' => 'friend-accepted-'.$addressee->id,
            'avatar' => $addressee->avatar_url,
        ]);
    }

    public function sendToSubscriptions(Collection $subscriptions, array $payload): int
    {
        if ($subscriptions->isEmpty() || ! $this->isConfigured()) {
            return 0;
        }

        $webPush = new \Minishlink\WebPush\WebPush([
            'VAPID' => [
                'subject' => config('app.url'),
                'publicKey' => config('services.webpush.vapid.public_key'),
                'privateKey' => config('services.webpush.vapid.private_key'),
            ],
        ]);

        foreach ($subscriptions as $subscription) {
            /** @var PushSubscription $subscription */
            try {
                $webPush->sendOneNotification(
                    new \Minishlink\WebPush\Subscription(
                        $subscription->endpoint,
                        $subscription->p256dh_key,
                        $subscription->auth_token,
                        'aesgcm'
                    ),
                    json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                );
            } catch (\Throwable $e) {
                Log::warning('webpush queue failed', ['id' => $subscription->id, 'error' => $e->getMessage()]);
            }
        }

        $sent = 0;
        foreach ($webPush->flush() as $report) {
            $endpoint = $report->getRequest()->getUri()->__toString();
            if ($report->isSuccess()) {
                $sent++;
            } elseif ($report->isSubscriptionExpired()) {
                PushSubscription::where('endpoint', $endpoint)->delete();
            } else {
                Log::warning('webpush failed', ['endpoint' => $endpoint, 'reason' => $report->getReason()]);
            }
        }

        return $sent;
    }
}
