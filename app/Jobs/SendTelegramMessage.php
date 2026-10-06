<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\TelegramNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Доставка одного TG-уведомления от бота в личку через Bot API.
 *
 * Строго 1 событие = 1 сообщение в Telegram: без пауз, кулдаунов
 * и склейки в саммари — как отправили, так и получили. Серия писем
 * подряд обрабатывается воркером очереди по одному, поэтому флуд
 * возникает редко; если Bot API всё же ответил 429, задача молча
 * возвращается в очередь с задержкой retry_after от Telegram и
 * доезжает следующим заходом — письма не теряются и не мнутся.
 * Задача никогда не кидает исключений наружу очереди: 403 (нет
 * /start или блок) помечает получателя и гасится, сетевые сбои
 * и 5xx уходят на повтор через release().
 */
class SendTelegramMessage implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * Максимум попыток: с запасом хватает на серию 429 подряд.
     */
    public int $tries = 10;

    /**
     * @param int $userId id получателя (users.id)
     * @param string $text текст в HTML-разметке Telegram (для фото — подпись, лимит 1024)
     * @param array<int, array<int, array<string, mixed>>> $buttons ряды inline-кнопок
     * @param string|null $photoUrl https-URL аватара автора (sendPhoto) или null (sendMessage)
     */
    public function __construct(
        public int $userId,
        public string $text,
        public array $buttons = [],
        public ?string $photoUrl = null,
    ) {
    }

    /**
     * Выполнить отправку.
     *
     * @return void
     */
    public function handle(): void
    {
        $outcome = self::attempt($this->userId, $this->text, $this->buttons, $this->photoUrl);
        $status = (string) ($outcome['status'] ?? 'failed');
        $retryAfter = (int) ($outcome['retry_after'] ?? 0);

        if ($status === 'retry' && $retryAfter > 0) {
            $this->release($retryAfter);
        }
    }

    /**
     * Одна попытка POST в Bot API с разбором статусов.
     *
     * Успех снимает пометку о блоке (самолечение после /start),
     * 403 ставит её, 429/5xx/сеть просят повтор через retry_after.
     *
     * @param int $userId id получателя (users.id)
     * @param string $text текст в HTML-разметке Telegram
     * @param array<int, array<int, array<string, mixed>>> $buttons ряды inline-кнопок
     * @param string|null $photoUrl https-URL фото для sendPhoto или null для sendMessage
     * @return array{status:string, retry_after:int} status: sent|blocked|retry|failed
     */
    public static function attempt(int $userId, string $text, array $buttons, ?string $photoUrl = null): array
    {
        $user = User::find($userId);

        if (! $user) {
            return ['status' => 'failed', 'retry_after' => 0];
        }

        $chatId = (int) ($user->telegram_id ?? 0);
        $botToken = (string) config('telegram.bot_token', '');

        if ($chatId <= 0) {
            Log::warning('telegram send skipped: unlinked', ['user_id' => $userId]);

            return ['status' => 'failed', 'retry_after' => 0];
        }

        if ($botToken === '') {
            Log::warning('telegram send skipped: no bot token', ['user_id' => $userId]);

            return ['status' => 'failed', 'retry_after' => 0];
        }

        $photo = self::cleanPhotoUrl($photoUrl);

        $endpoint = $photo !== null ? 'sendPhoto' : 'sendMessage';

        $payload = [
            'chat_id' => $chatId,
            'parse_mode' => 'HTML',
        ];

        if ($photo !== null) {
            $payload['photo'] = $photo;
            $payload['caption'] = mb_substr($text, 0, 1000);
        } else {
            $payload['text'] = $text;
            $payload['disable_web_page_preview'] = true;
        }

        if ($buttons !== []) {
            $payload['reply_markup'] = ['inline_keyboard' => $buttons];
        }

        try {
            $response = Http::timeout(12)->post("https://api.telegram.org/bot{$botToken}/{$endpoint}", $payload);
        } catch (\Throwable $e) {
            Log::warning('telegram send failed', ['chat_id' => $chatId, 'error' => $e->getMessage()]);

            return ['status' => 'retry', 'retry_after' => 30];
        }

        if ($response->successful()) {
            TelegramNotifier::clearBlocked($user);
            Log::info('telegram notify sent', ['user_id' => $userId, 'chat_id' => $chatId, 'via' => $photo !== null ? 'photo' : 'text']);

            return ['status' => 'sent', 'retry_after' => 0];
        }

        $status = $response->status();
        $body = $response->json();
        $description = (string) (($body['description'] ?? null) ?? mb_substr((string) $response->body(), 0, 200));

        if ($status === 403) {
            TelegramNotifier::markBlocked($user);

            return ['status' => 'blocked', 'retry_after' => 0];
        }

        if ($status === 429) {
            $rawRetry = (int) (($body['parameters']['retry_after'] ?? 0) ?? 0);
            $backoff = max(1, min(300, $rawRetry > 0 ? $rawRetry : 30));
            Log::warning('telegram flood limited', ['chat_id' => $chatId, 'retry_after' => $backoff, 'description' => $description]);

            return ['status' => 'retry', 'retry_after' => $backoff];
        }

        if ($status >= 500) {
            Log::warning('telegram server error', ['chat_id' => $chatId, 'status' => $status, 'description' => $description]);

            return ['status' => 'retry', 'retry_after' => 60];
        }

        if ($photo !== null && $status === 400) {
            Log::warning('telegram photo rejected, fallback to text', ['chat_id' => $chatId, 'description' => $description]);

            $fallback = [
                'chat_id' => $chatId,
                'text' => $text,
                'parse_mode' => 'HTML',
                'disable_web_page_preview' => true,
            ];

            if ($buttons !== []) {
                $fallback['reply_markup'] = ['inline_keyboard' => $buttons];
            }

            try {
                $retry = Http::timeout(8)->post("https://api.telegram.org/bot{$botToken}/sendMessage", $fallback);
            } catch (\Throwable $e) {
                return ['status' => 'retry', 'retry_after' => 30];
            }

            if ($retry->successful()) {
                TelegramNotifier::clearBlocked($user);
                Log::info('telegram notify sent', ['user_id' => $userId, 'chat_id' => $chatId, 'fallback' => 'text']);

                return ['status' => 'sent', 'retry_after' => 0];
            }
        }

        Log::warning('telegram send rejected', ['chat_id' => $chatId, 'status' => $status, 'description' => $description]);

        return ['status' => 'failed', 'retry_after' => 0];
    }

    /**
     * Почистить URL фото для Bot API: только публичный https.
     *
     * Telegram качает фото своими серверами, поэтому локальный http
     * и относительные пути отбрасываем — уйдём в обычный sendMessage.
     *
     * @param string|null $raw сырой URL аватара
     * @return string|null чистый https-URL или null
     */
    private static function cleanPhotoUrl(?string $raw): ?string
    {
        $clean = trim((string) $raw);

        if ($clean === '') {
            return null;
        }

        if (! str_starts_with($clean, 'https://')) {
            return null;
        }

        if (mb_strlen($clean) > 512) {
            return null;
        }

        return $clean;
    }
}
