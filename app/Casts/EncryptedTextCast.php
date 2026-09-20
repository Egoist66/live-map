<?php

namespace App\Casts;

use App\Services\MessageCrypto;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Универсальный каст пользовательских текстов: в БД AES-256-GCM, в коде открытый текст.
 *
 * Тот же MessageCrypto и формат "gcm1:", что у сообщений чата.
 * Legacy-plaintext без префикса читается как есть для плавной миграции.
 * В отличие от MessageBodyCast сохраняет null (nullable-колонки: bio, thought).
 */
class EncryptedTextCast implements CastsAttributes
{
    /**
     * Расшифровать значение из БД.
     *
     * @param Model $model
     * @param string $key
     * @param mixed $value
     * @param array $attributes
     * @return string|null
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        return MessageCrypto::decrypt(is_string($value) ? $value : null);
    }

    /**
     * Зашифровать значение перед записью.
     *
     * @param Model $model
     * @param string $key
     * @param mixed $value
     * @param array $attributes
     * @return array<string, string|null>
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null) {
            return [$key => null];
        }

        $plain = is_string($value) ? $value : (string) $value;

        return [$key => MessageCrypto::encrypt($plain)];
    }
}
