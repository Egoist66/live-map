<?php

namespace App\Services;

/**
 * Проверка подписи Telegram WebApp initData.
 *
 * Алгоритм по докам Telegram (Mini Apps):
 * - из initData убираем `hash`, сортируем остальные `key=value` по ключу,
 *   склеиваем через "\n" → data-check-string;
 * - secret_key = HMAC_SHA256(bot_token, key="WebAppData");
 * - hash = HMAC_SHA256(data-check-string, secret_key);
 * - сравниваем через hash_equals с переданным `hash`.
 *
 * Дополнительно проверяем `auth_date` против config/telegram.php max_age.
 */
class TelegramInitDataValidator
{
    /**
     * Результат валидации: telegram user + сырые поля initData.
     *
     * @var array{user: array<string, mixed>, auth_date: int, raw: array<string, string>}|null
     */
    private ?array $parsed = null;

    /**
     * @param string $botToken токен бота @U1ove_bot из config/telegram.php
     * @param int $maxAgeSeconds максимальный возраст auth_date (защита от replay)
     */
    public function __construct(
        private readonly string $botToken = '',
        private readonly int $maxAgeSeconds = 86400,
    ) {}

    /**
     * Проверить строку initData от Telegram.WebApp.
     *
     * Пустая строка, битый hash, просроченный auth_date —
     * всё это false без исключений (контроллер отдаст 401).
     *
     * @param string $initData сырая строка window.Telegram.WebApp.initData
     * @return bool true — подпись сошлась и auth_date свежий
     */
    public function validate(string $initData): bool
    {
        $this->parsed = null;

        $botToken = $this->botToken !== '' ? $this->botToken : (string) config('telegram.bot_token', '');

        if ($initData === '' || $botToken === '') {
            return false;
        }

        $pairs = $this->parsePairs($initData);
        $hash = $pairs['hash'] ?? '';

        if ($hash === '' || ! preg_match('/^[0-9a-f]{64}$/i', $hash)) {
            return false;
        }

        unset($pairs['hash']);

        $checkString = $this->buildCheckString($pairs);
        $secretKey = hash_hmac('sha256', $botToken, 'WebAppData', true);
        $calculated = hash_hmac('sha256', $checkString, $secretKey);

        $isValid = hash_equals(strtolower($hash), strtolower($calculated));

        if (! $isValid) {
            return false;
        }

        $user = $this->parseUser($pairs['user'] ?? '');
        $authDate = (int) ($pairs['auth_date'] ?? 0);

        if ($user === null || ($user['id'] ?? 0) <= 0 || $authDate <= 0) {
            return false;
        }

        $maxAge = $this->maxAgeSeconds > 0 ? $this->maxAgeSeconds : (int) config('telegram.max_age', 86400);

        $isExpired = (time() - $authDate) > $maxAge;

        if ($isExpired) {
            return false;
        }

        $this->parsed = [
            'user' => $user,
            'auth_date' => $authDate,
            'raw' => $pairs,
        ];

        return true;
    }

    /**
     * Разобранный telegram-пользователь после успешного validate().
     *
     * @return array{user: array<string, mixed>, auth_date: int, raw: array<string, string>}|null
     */
    public function parsed(): ?array
    {
        return $this->parsed;
    }

    /**
     * Разобрать initData в пары key => value (без urldecode-проблем).
     *
     * @param string $initData сырая query-строка initData
     * @return array<string, string>
     */
    private function parsePairs(string $initData): array
    {
        $pairs = [];

        $chunks = explode('&', $initData);

        foreach ($chunks as $chunk) {
            if ($chunk === '') {
                continue;
            }

            $pos = strpos($chunk, '=');

            if ($pos === false) {
                continue;
            }

            $key = urldecode(substr($chunk, 0, $pos));
            $value = urldecode(substr($chunk, $pos + 1));

            if ($key !== '') {
                $pairs[$key] = $value;
            }
        }

        return $pairs;
    }

    /**
     * Собрать data-check-string: сортировка по ключу + "\n".
     *
     * @param array<string, string> $pairs пары без hash
     * @return string
     */
    private function buildCheckString(array $pairs): string
    {
        ksort($pairs, SORT_STRING);

        $lines = [];

        foreach ($pairs as $key => $value) {
            $lines[] = $key.'='.$value;
        }

        return implode("\n", $lines);
    }

    /**
     * Разобрать поле `user` (JSON) из initData.
     *
     * @param string $rawJson JSON объекта пользователя Telegram
     * @return array<string, mixed>|null
     */
    private function parseUser(string $rawJson): ?array
    {
        if ($rawJson === '') {
            return null;
        }

        try {
            $decoded = json_decode($rawJson, true, 8, JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return null;
        }

        if (! is_array($decoded)) {
            return null;
        }

        return $decoded;
    }
}
