<?php

namespace App\Casts;

use App\Services\MessageCrypto;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Каст messages.body: в БД AES-256-GCM, в коде открытый текст.
 *
 * Чтение legacy-plaintext без префикса отдаёт как есть,
 * запись пустой строки хранит пустой (вложения без текста).
 */
class MessageBodyCast implements CastsAttributes
{
    /**
     * Расшифровать значение из БД.
     *
     * @param Model $model
     * @param string $key
     * @param mixed $value
     * @param array $attributes
     * @return string
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): string
    {
        return MessageCrypto::decrypt(is_string($value) ? $value : null);
    }

    /**
     * Зашифровать значение перед записью.
     *
     * @param Model $model
     * @param string $key
     * @param mixed $value
     * @param array $attributes
     * @return array<string, string>
     */
    public function set(Model $model, string $key, mixed $value, array $attributes): array
    {
        $plain = is_string($value) ? $value : (string) ($value ?? '');

        return [$key => MessageCrypto::encrypt($plain)];
    }
}
