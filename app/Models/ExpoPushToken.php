<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Expo-пуш токен устройства (upin-mobile WebView).
 *
 * Привязка user_id <-> token, токен формата ExponentPushToken[...] / ExpoPushToken[...].
 *
 * @property int $id
 * @property int $user_id
 * @property string $token
 * @property string|null $platform
 */
class ExpoPushToken extends Model
{
    protected $fillable = ['user_id', 'token', 'platform'];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
