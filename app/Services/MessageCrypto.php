<?php

namespace App\Services;

/**
 * Шифрование тел сообщений чата (AES-256-GCM).
 *
 * Формат хранения в messages.body: "gcm1:" + base64(iv 12 байт + tag 16 байт + ciphertext).
 * Ключ 32 байта: env MESSAGE_CRYPTO_KEY (base64) либо производный от APP_KEY,
 * чтобы старые установки не падали в plaintext при отсутствии ключа.
 */
class MessageCrypto
{
    private const PREFIX = 'gcm1:';

    private const CIPHER = 'aes-256-gcm';

    private static ?string $cachedKey = null;

    /**
     * Проверить, что значение уже зашифровано нашим форматом.
     *
     * @param string|null $value сырое значение из БД
     * @return bool
     */
    public static function isEncrypted(?string $value): bool
    {
        if ($value === null || $value === '') {
            return false;
        }

        return str_starts_with($value, self::PREFIX);
    }

    /**
     * Зашифровать открытый текст.
     *
     * @param string $plain открытый текст (может быть пустым — вернётся как есть)
     * @return string шифротекст либо '' для пустого входа
     * @throws \RuntimeException при недоступности шифра
     */
    public static function encrypt(string $plain): string
    {
        if ($plain === '') {
            return '';
        }

        $key = self::key();
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, self::CIPHER, $key, OPENSSL_RAW_DATA, $iv, $tag);

        if ($cipher === false || $tag === '') {
            throw new \RuntimeException('Message encryption failed');
        }

        return self::PREFIX.base64_encode($iv.$tag.$cipher);
    }

    /**
     * Расшифровать значение из БД.
     *
     * Legacy-plaintext (без префикса) возвращается как есть для плавной миграции.
     *
     * @param string|null $value сырое значение из БД
     * @return string открытый текст
     */
    public static function decrypt(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        if (! self::isEncrypted($value)) {
            return $value;
        }

        $raw = base64_decode(substr($value, strlen(self::PREFIX)), true);

        if ($raw === false || strlen($raw) < 28) {
            return '';
        }

        $iv = substr($raw, 0, 12);
        $tag = substr($raw, 12, 16);
        $cipher = substr($raw, 28);
        $plain = openssl_decrypt($cipher, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv, $tag);

        return $plain === false ? '' : $plain;
    }

    /**
     * 32-байтный ключ шифрования.
     *
     * @return string
     */
    private static function key(): string
    {
        if (self::$cachedKey !== null) {
            return self::$cachedKey;
        }

        $configured = (string) config('services.messages_crypto_key', '');
        $decoded = $configured !== '' ? base64_decode($configured, true) : false;

        if (is_string($decoded) && strlen($decoded) === 32) {
            return self::$cachedKey = $decoded;
        }

        $appKey = (string) config('app.key', '');

        if (str_starts_with($appKey, 'base64:')) {
            $appKey = (string) base64_decode(substr($appKey, 7), true);
        }

        return self::$cachedKey = hash('sha256', $appKey.'|messages-gcm-v1', true);
    }
}
