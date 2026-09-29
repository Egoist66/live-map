<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Намерение поделиться Telegram-username в диалоге.
 *
 * Обмен срабатывает только при взаимном согласии: когда оба участника
 * direct-диалога создали оффер, сервис рассылает каждому @username
 * собеседника в личку бота. Юзернеймы никому не светим до момента
 * обмена — ни в API, ни в боте.
 *
 * @property int $id
 * @property int $conversation_id
 * @property int $user_id
 * @property \Carbon\Carbon|null $exchanged_at Когда обмен состоялся
 */
class TelegramShareOffer extends Model
{
    protected $fillable = [
        'conversation_id',
        'user_id',
        'exchanged_at',
    ];

    protected $casts = [
        'exchanged_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
