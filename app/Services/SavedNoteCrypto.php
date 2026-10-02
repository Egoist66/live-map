<?php

namespace App\Services;

/**
 * Сжатие + шифрование тел заметок «Избранного».
 *
 * Формат: gzencode(plain, 9) → MessageCrypto::encrypt (AES-256-GCM, "gcm1:").
 * Сжатие даёт ~60-80% экономии на тексте/ссылках до шифрования — в БД лежат
 * только короткие base64-шифротексты. Расшифровка с fallback: если gzdecode
 * не сошёлся — возвращаем сырец (legacy без сжатия), пустое — пустым.
 */
class SavedNoteCrypto
{
    /**
     * Сжать и зашифровать открытый текст заметки.
     *
     * @param string $plain открытый текст (обрезан вызывающим до лимита)
     * @return string шифротекст для колонки payload ('' для пустого входа)
     */
    public static function encrypt(string $plain): string
    {
        if ($plain === '') {
            return '';
        }

        $compressed = gzencode($plain, 9);

        if ($compressed === false) {
            $compressed = $plain;
        }

        return MessageCrypto::encrypt($compressed);
    }

    /**
     * Расшифровать и распаковать payload из БД.
     *
     * @param string|null $payload сырое значение колонки payload
     * @return string открытый текст заметки
     */
    public static function decrypt(?string $payload): string
    {
        $raw = MessageCrypto::decrypt($payload);

        if ($raw === '') {
            return '';
        }

        $decoded = @gzdecode($raw);

        return $decoded === false ? $raw : $decoded;
    }
}
