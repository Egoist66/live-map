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

    public function sendPinActivity(User $recipient, User $actor, \App\Models\Pin $pin, \App\Models\PinActivity $activity): int
    {
        $name = $actor->name ?: 'Кто-то';
        $title = mb_strimwidth($pin->title ?: 'Пин', 0, 40, '…');
        if ($activity->kind === 'comment') {
            $body = $activity->excerpt ? "{$name}: {$activity->excerpt}" : "{$name} комментирует «{$title}»";
            $tag = "pin-{$pin->id}-comment-{$activity->id}";
        } elseif ($activity->kind === 'mention') {
            $body = $activity->excerpt ? "{$name} упомянул вас: {$activity->excerpt}" : "{$name} упомянул вас в «{$title}»";
            $tag = "pin-{$pin->id}-mention-{$activity->id}";
        } else {
            $emoji = ['like' => '❤️', 'fire' => '🔥', 'laugh' => '😂', 'sad' => '😢', 'angry' => '😡', 'useful' => '👍'][$activity->reaction_type ?? ''] ?? '⭐';
            $body = "{$name} {$emoji} «{$title}»";
            $tag = "pin-{$pin->id}-reaction-{$activity->id}";
        }
        return $this->sendToUser($recipient, [
            'title' => 'Активность пина',
            'body' => $body,
            'url' => '/map?pin='.$pin->id.($activity->comment_id ? '&comment='.$activity->comment_id : ''),
            'tag' => $tag,
            'avatar' => $actor->avatar_url,
        ]);
    }

    public function sendPhotoActivity(User $recipient, User $actor, \App\Models\ProfilePhoto $photo, \App\Models\PinActivity $activity): int
    {
        $name = $activity->is_incognito ? 'Тайный поклонник' : ($actor->name ?: 'Кто-то');
        $avatar = $activity->is_incognito ? null : $actor->avatar_url;
        if ($activity->kind === 'photo_like') {
            return $this->sendToUser($recipient, [
                'title' => 'Лайк фото',
                'body' => "{$name} лайкнул ваше фото",
                'url' => '/users/'.$photo->user_id.'?photo='.$photo->id,
                'tag' => "photo-{$photo->id}-like-{$activity->id}",
                'avatar' => $avatar,
            ]);
        }
        if ($activity->kind === 'mention') {
            $title = 'Вас упомянули';
            $body = $activity->excerpt ? "{$name} упомянул вас: {$activity->excerpt}" : "{$name} упомянул вас в комментарии к фото";
            $tag = "photo-{$photo->id}-mention-{$activity->id}";
        } else {
            $title = 'Комментарий к фото';
            $body = $activity->excerpt ? "{$name}: {$activity->excerpt}" : "{$name} прокомментировал ваше фото";
            $tag = "photo-{$photo->id}-comment-{$activity->id}";
        }
        return $this->sendToUser($recipient, [
            'title' => $title,
            'body' => $body,
            'url' => '/users/'.$photo->user_id.'?photo='.$photo->id.($activity->photo_comment_id ? '&comment='.$activity->photo_comment_id : ''),
            'tag' => $tag,
            'avatar' => $avatar,
        ]);
    }

    public function sendSwipeActivity(User $recipient, User $actor, \App\Models\PinActivity $activity): int
    {
        $name = $activity->is_incognito ? 'Тайный поклонник' : ($actor->name ?: 'Кто-то');
        $avatar = $activity->is_incognito ? null : $actor->avatar_url;
        if ($activity->kind === 'match') {
            return $this->sendToUser($recipient, [
                'title' => '💞 Новый мэтч!',
                'body' => "{$actor->name} тоже лайкнул тебя — чат открыт",
                'url' => '/swipes',
                'tag' => 'match-'.$activity->id,
                'avatar' => $actor->avatar_url,
            ]);
        }
        return $this->sendToUser($recipient, [
            'title' => '💘 Тебя лайкнули в ULove',
            'body' => $activity->is_incognito ? 'Тайный поклонник отреагировал на твою анкету' : "{$name} отреагировал на твою анкету",
            'url' => '/swipes?tab=admirers',
            'tag' => 'swipe-like-'.$activity->id,
            'avatar' => $avatar,
        ]);
    }

    public function sendReport(User $recipient, \App\Models\Report $report): int
    {
        $reasons = \App\Models\Report::reasons();
        $reason = $reasons[$report->reason] ?? $report->reason;
        $title = $report->targetTitle();
        return $this->sendToUser($recipient, [
            'title' => "Жалоба #{$report->id}: {$reason}",
            'body' => ($title ? "«{$title}»" : "{$report->target_type} #{$report->target_id}").($report->description ? " — {$report->description}" : ''),
            'url' => '/settings?tab=admin',
            'tag' => 'report-'.$report->id,
            'avatar' => null,
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
