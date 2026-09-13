<?php

namespace App\Services;

use App\Models\ConversationParticipant;
use App\Models\DeviceToken;
use App\Models\Friendship;
use App\Models\Message;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Messaging;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\AndroidConfig;
use Kreait\Firebase\Messaging\ApnsConfig;
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

        return $this->sendToTokens($tokens, $payload, $this->badgeFor($user));
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
     * @param int $badge счётчик непрочитанного для иконки
     * @return int число успешных доставок
     */
    protected function sendToTokens(array $tokens, array $payload, int $badge = 0): int
    {
        $messaging = $this->messaging();
        if ($messaging === null) {
            return 0;
        }

        $message = $this->buildMessage($payload, $badge);

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
     * Счётчик едет двумя путями: `badge` в data (читает натив для иконки)
     * и aps-бейдж для iOS (система ставит его даже при убитом приложении).
     *
     * @param array{title:string,body:string,url:string,tag:string,avatar:string|null} $payload содержимое
     * @param int $badge счётчик непрочитанного для иконки
     */
    protected function buildMessage(array $payload, int $badge = 0): CloudMessage
    {
        $notification = Notification::create($payload['title'], $payload['body']);

        $data = [
            'url' => (string) ($payload['url'] ?? '/'),
            'tag' => (string) ($payload['tag'] ?? 'upin'),
            'badge' => (string) max(0, $badge),
        ];

        $android = AndroidConfig::fromArray(['priority' => 'high']);
        $apns = ApnsConfig::new()->withBadge(max(0, $badge));

        return CloudMessage::new()
            ->withNotification($notification)
            ->withData($data)
            ->withAndroidConfig($android)
            ->withApnsConfig($apns);
    }

    /**
     * Счётчик непрочитанного для бейджа иконки.
     *
     * Непрочитанные сообщения в диалогах пользователя плюс входящие
     * заявки в друзья. Ошибка подсчёта — не повод ронять пуш.
     *
     * @param User $user получатель
     * @return int суммарный счётчик
     */
    protected function badgeFor(User $user): int
    {
        try {
            $userId = (int) $user->id;

            $convIds = ConversationParticipant::where('user_id', $userId)
                ->whereNull('hidden_at')
                ->pluck('conversation_id')
                ->all();

            $unread = 0;
            if ($convIds !== []) {
                $unread = Message::whereIn('conversation_id', $convIds)
                    ->where('sender_id', '!=', $userId)
                    ->whereNull('read_at')
                    ->count();
            }

            $pending = Friendship::where('status', 'pending')
                ->where('addressee_id', $userId)
                ->count();

            return max(0, (int) $unread + (int) $pending);
        } catch (\Throwable $e) {
            Log::warning('fcm badge count failed', ['error' => $e->getMessage()]);

            return 0;
        }
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
     *
     * Источник ключа по приоритету: файл FIREBASE_CREDENTIALS (локально),
     * иначе FIREBASE_CREDENTIALS_JSON из окружения (base64 или сырой JSON —
     * для эфемерных хостингов вроде Laravel Cloud, где файлы storage
     * не переживают деплой). JSON из окружения материализуется в тот же
     * файл, чтобы дальше работал единый путь через withServiceAccount().
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
                $path = $this->materializeCredentialsFromEnv($path);
            }
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

    /**
     * Сохранить service-account ключ из FIREBASE_CREDENTIALS_JSON в файл.
     *
     * Принимает base64 или сырой JSON, проверяет наличие private_key,
     * чтобы мусор из окружения не превращался в «валидный» путь.
     *
     * @param string $fallbackPath путь, куда положить ключ
     * @return string путь к файлу или '' если ключа нет
     */
    protected function materializeCredentialsFromEnv(string $fallbackPath): string
    {
        try {
            $raw = trim((string) config('services.firebase.credentials_json'));
            if ($raw === '') {
                return '';
            }

            $decoded = base64_decode($raw, true);
            $json = $decoded !== false ? $decoded : $raw;

            $data = json_decode($json, true);
            if (! is_array($data) || empty($data['private_key']) || empty($data['client_email'])) {
                Log::warning('fcm env credentials invalid');

                return '';
            }

            $target = $fallbackPath !== '' ? $fallbackPath : storage_path('app/firebase/service-account.json');
            $dir = dirname($target);
            if (! is_dir($dir)) {
                mkdir($dir, 0755, true);
            }
            file_put_contents($target, $json);

            return $target;
        } catch (\Throwable $e) {
            Log::warning('fcm env credentials failed', ['error' => $e->getMessage()]);

            return '';
        }
    }
}
