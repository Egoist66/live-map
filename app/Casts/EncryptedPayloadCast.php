<?php

namespace App\Casts;

use App\Services\MessageCrypto;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/**
 * Каст notifications.data: весь пейлоад шифруется конвертом {"__enc": blob}.
 *
 * JSON остаётся валидным и после шифрования, запросы по type/key/read_at
 * не трогают data и работают как раньше. Legacy-строки без конверта
 * читаются как есть для плавной миграции. Админские типы app.* пишутся
 * базовым DatabaseNotification открытым текстом — по ним есть
 * JSON-запросы data->update_id, мимо этой модели они не ходят.
 */
class EncryptedPayloadCast implements CastsAttributes
{
    private const ENVELOPE = '__enc';

    /**
     * Расшифровать пейлоад из БД.
     *
     * @param Model $model
     * @param string $key
     * @param mixed $value
     * @param array $attributes
     * @return array<string, mixed>
     */
    public function get(Model $model, string $key, mixed $value, array $attributes): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        $data = is_array($value) ? $value : json_decode((string) $value, true);

        if (! is_array($data)) {
            return [];
        }

        if (! isset($data[self::ENVELOPE]) || ! is_string($data[self::ENVELOPE])) {
            return $data;
        }

        $decoded = json_decode(MessageCrypto::decrypt($data[self::ENVELOPE]), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Зашифровать пейлоад перед записью.
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

        $list = is_array($value) ? $value : [];
        $json = json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if (! is_string($json)) {
            $json = '[]';
        }

        $envelope = json_encode([self::ENVELOPE => MessageCrypto::encrypt($json)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return [$key => is_string($envelope) ? $envelope : null];
    }
}
