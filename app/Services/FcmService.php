<?php

namespace App\Services;

use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\AndroidConfig;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;

/**
 * Отправка системных пушей в нативные приложения через Firebase Cloud Messaging.
 *
 * Зеркалит WebPushService: те же два метода (sendToUser/sendChatMessage) и та же
 * форма пейлоада {title, body, url, tag, avatar}. Токены берёт из device_tokens,
 * куда их кладёт Capacitor-хук useNativePush через POST /api/device-tokens.
 * Невалидные токены (unknown/invalid) удаляются, чтобы не слать в пустоту.
 */
class FcmService
{
    protected ?Messaging $messaging = null;

    protected bool $booted = false;

    /**
     * Есть ли доступ к FCM (SDK + service-account JSON на месте).
     */
    public function isConfigured(): bool
    {
        return $this->messaging() !== null;
    }

    /**
     * Системный пуш пользователю на все его устройства.
     *
     * @param User $user получатель
     * @param array{title:string,body:string,url:string,tag:string,avatar:string|null} $payload тот же формат, что у WebPushService
     * @return int сколько токенов успешно доставлено
     */
    public function sendToUser(User $user, array $payload): int
    {
        $tokens = $this->tokensFor($user);
        if ($tokens === []) {
            return 0;
        }

        return $this->sendToTokens($tokens, $payload);
    }

    /**
     * Системный пуш о новом сообщении чата.
     *
     * @param User $recipient получатель
     * @param User $sender отправитель
     * @param int $conversationId id диалога для диплинка
     * @param string $body текст сообщения
     * @return int сколько токенов успешно доставлено
     */
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
            'tag' => 'chat-'.$conversationId,
            'avatar' => $sender->avatar_url,
        ]);
    }

    /**
     * FCM-токены пользователя из device_tokens.
     *
     * @param User $user получатель
     * @return string[]
     */
    protected function tokensFor(User $user): array
    {
        return $user->deviceTokens()
            ->pluck('token')
            ->filter()
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Низкоуровневая отправка notification+data сообщения на токены.
     *
     * Notification-блок показывает системный баннер даже при убитом приложении,
     * data-блок (url/tag) забирает фронт для диплинка и тоста в foreground.
     *
     * @param string[] $tokens FCM-токены
     * @param array{title:string,body:string,url:string,tag:string,avatar:string|null} $payload содержимое
     * @return int число успешных доставок
     */
    protected function sendToTokens(array $tokens, array $payload): int
    {
        $messaging = $this->messaging();
        if ($messaging === null) {
            return 0;
        }

        $message = $this->buildMessage($payload);

        try {
            $report = $messaging->sendMulticast($message, $tokens);
        } catch (\Throwable $e) {
            Log::warning('fcm send failed', ['error' => $e->getMessage()]);

            return 0;
        }

        $this->pruneDeadTokens($report->unknownTokens());
        $this->pruneDeadTokens($report->invalidTokens());

        return $report->successes()->count();
    }

    /**
     * Собрать CloudMessage: баннер + data для диплинка + высокий приоритет на Android.
     *
     * @param array{title:string,body:string,url:string,tag:string,avatar:string|null} $payload содержимое
     */
    protected function buildMessage(array $payload): CloudMessage
    {
        $notification = Notification::create($payload['title'], $payload['body']);

        $data = [
            'url' => (string) ($payload['url'] ?? '/'),
            'tag' => (string) ($payload['tag'] ?? 'upin'),
        ];

        $android = AndroidConfig::fromArray(['priority' => 'high']);

        return CloudMessage::new()
            ->withNotification($notification)
            ->withData($data)
            ->withAndroidConfig($android);
    }

    /**
     * Удалить мёртвые токены, чтобы не слать в пустоту.
     *
     * @param string[] $tokens токены для удаления
     */
    protected function pruneDeadTokens(array $tokens): void
    {
        if ($tokens === []) {
            return;
        }

        try {
            DeviceToken::whereIn('token', $tokens)->delete();
        } catch (\Throwable $e) {
            Log::warning('fcm prune failed', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Ленивый FCM-клиент из service-account JSON.
     */
    protected function messaging(): ?Messaging
    {
        if ($this->booted) {
            return $this->messaging;
        }

        $this->booted = true;

        try {
            $path = (string) config('services.firebase.credentials');
            if ($path === '' || ! is_file($path)) {
                return null;
            }
            $this->messaging = (new Factory)->withServiceAccount($path)->createMessaging();
        } catch (\Throwable $e) {
            Log::warning('fcm init failed', ['error' => $e->getMessage()]);

            return null;
        }

        return $this->messaging;
    }
}
