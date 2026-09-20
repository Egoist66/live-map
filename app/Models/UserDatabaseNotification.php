<?php

namespace App\Models;

use App\Casts\EncryptedPayloadCast;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Строка inbox-таблицы notifications с шифрованным пейлоадом data.
 *
 * Та же таблица и API, что у DatabaseNotification: запросы по
 * notifiable/type/key/read_at не читают data и работают как раньше.
 * Читатели (колокольчик, сериализация, broadcast) получают пейлоад
 * расшифрованным через каст — фронт без изменений.
 */
class UserDatabaseNotification extends DatabaseNotification
{
    protected $casts = [
        'data' => EncryptedPayloadCast::class,
        'read_at' => 'datetime',
    ];
}
