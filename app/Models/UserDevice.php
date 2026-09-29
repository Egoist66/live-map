<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Известное устройство пользователя для охраны входов.
 *
 * Отпечаток считается по связке платформа + браузер + класс
 * устройства + клиент (без версий и IP — они меняются сами):
 * новый отпечаток означает вход с другого устройства и триггерит
 * алерт «Вход с нового устройства» (см. LoginDeviceGuard).
 *
 * @property int $id
 * @property int $user_id
 * @property string $fingerprint
 * @property string|null $ip
 * @property string|null $user_agent
 * @property string $device
 * @property string|null $platform
 * @property string|null $browser
 * @property string $client
 * @property bool $trusted пользователь подтвердил, что это его устройство
 * @property bool $blocked устройство заблокировано навсегда
 * @property string|null $session_id последний web-сеанс устройства
 * @property string|null $country
 * @property string|null $country_code
 * @property string|null $city
 * @property \Carbon\Carbon|null $first_seen_at
 * @property \Carbon\Carbon|null $last_seen_at
 */
class UserDevice extends Model
{
    protected $fillable = [
        'user_id',
        'fingerprint',
        'ip',
        'user_agent',
        'device',
        'platform',
        'browser',
        'client',
        'trusted',
        'blocked',
        'session_id',
        'country',
        'country_code',
        'city',
        'first_seen_at',
        'last_seen_at',
    ];

    protected $casts = [
        'trusted' => 'boolean',
        'blocked' => 'boolean',
        'first_seen_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];

    /**
     * Владелец устройства.
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Человеческая подпись устройства для алертов и списков.
     *
     * @return string вроде «Chrome · Windows» или «Telegram · Android»
     */
    public function label(): string
    {
        $browser = trim((string) ($this->browser ?? ''));
        $platform = trim((string) ($this->platform ?? ''));

        if ($this->client === 'telegram') {
            return $platform !== '' ? 'Telegram · '.$platform : 'Telegram';
        }

        if ($browser !== '' && $platform !== '') {
            return $browser.' · '.$platform;
        }

        return $browser !== '' ? $browser : ($platform !== '' ? $platform : 'Неизвестное устройство');
    }
}
