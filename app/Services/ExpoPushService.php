<?php

namespace App\Services;

use App\Models\ExpoPushToken;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Системные пуши в нативное приложение (Expo Push Service).
 *
 * Web Push (VAPID) внутри WebView не показывается в шторке и не ставит
 * бейдж на иконке — поэтому дублируем туда же через Expo.
 * Токены вида ExponentPushToken[...] присылает приложение через
 * window.UPinApp.expoPushToken (см. resources/js/native/expo-push.ts).
 */
class ExpoPushService
{
    private const ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    public function sendToUser(User $user, array $webPayload, ?string $channelId = null): int
    {
        $tokens = $user->expoPushTokens()->pluck('token')->all();
        if (empty($tokens)) {
            return 0;
        }

        return $this->send($tokens, [
            'title' => (string) ($webPayload['title'] ?? 'UPin'),
            'body' => (string) ($webPayload['body'] ?? ''),
            'url' => (string) ($webPayload['url'] ?? '/'),
        ], $channelId, (int) $user->id);
    }

    public function sendChatMessage(User $recipient, User $sender, int $conversationId, string $body): int
    {
        $preview = trim((string) preg_replace('/\s+/', ' ', $body));
        if (mb_strlen($preview) > 120) {
            $preview = mb_substr($preview, 0, 117).'...';
        }

        return $this->sendToUser($recipient, [
            'title' => $sender->name ?: 'Новое сообщение',
            'body' => $preview !== '' ? $preview : 'Новое сообщение',
            'url' => '/chat/'.$conversationId,
        ], 'upin-messages');
    }

    /**
     * @param string[] $tokens
     */
    public function send(array $tokens, array $webPayload, ?string $channelId, ?int $userId = null): int
    {
        $tokens = array_values(array_unique(array_filter($tokens, fn ($t) => str_starts_with((string) $t, 'ExponentPushToken['))));
        if (empty($tokens)) {
            return 0;
        }

        $badge = $userId ? $this->unreadBadge($userId) : 1;
        $url = $this->absoluteUrl((string) ($webPayload['url'] ?? '/'));

        $sent = 0;
        foreach (array_chunk($tokens, 100) as $chunk) {
            $messages = array_map(fn ($to) => [
                'to' => $to,
                'title' => (string) ($webPayload['title'] ?? 'UPin'),
                'body' => (string) ($webPayload['body'] ?? ''),
                'badge' => $badge,
                'sound' => 'default',
                'channelId' => $channelId ?? $this->channelForUrl($url),
                'data' => ['url' => $url],
            ], $chunk);

            try {
                $res = Http::timeout(10)->post(self::ENDPOINT, $messages);
                $tickets = $res->json('data');
                if (! is_array($tickets)) {
                    $tickets = [];
                }
                foreach ($tickets as $i => $ticket) {
                    if (($ticket['status'] ?? '') === 'ok') {
                        $sent++;
                    } elseif (($ticket['details']['error'] ?? '') === 'DeviceNotRegistered') {
                        ExpoPushToken::where('token', $chunk[$i] ?? '')->delete();
                    } else {
                        Log::warning('expo push ticket failed', ['token' => $chunk[$i] ?? null, 'ticket' => $ticket]);
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('expo push send failed', ['error' => $e->getMessage()]);
            }
        }

        return $sent;
    }

    private function unreadBadge(int $userId): int
    {
        try {
            return (int) \Illuminate\Notifications\DatabaseNotification::where('notifiable_type', (new User)->getMorphClass())
                ->where('notifiable_id', $userId)
                ->whereNull('read_at')
                ->count() + 1;
        } catch (\Throwable) {
            return 1;
        }
    }

    private function absoluteUrl(string $url): string
    {
        if (str_starts_with($url, 'http')) {
            return $url;
        }
        $base = rtrim((string) config('app.url', 'https://upin.laravel.cloud'), '/');

        return $base.'/'.ltrim($url, '/');
    }

    private function channelForUrl(string $url): string
    {
        if (str_contains($url, '/chat')) {
            return 'upin-messages';
        }

        return 'upin-social';
    }
}
