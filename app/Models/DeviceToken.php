<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * FCM/APNs токен мобильного устройства.
 *
 * Web Push продолжает жить в push_subscriptions,
 * сюда пишут только нативные приложения (Capacitor).
 *
 * @property int $id
 * @property int $user_id
 * @property string $platform ios|android
 * @property string $provider fcm|apns
 * @property string $token
 */
class DeviceToken extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'platform',
        'provider',
        'token',
    ];

    /**
     * Владелец устройства.
     *
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
