<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Одна доставленная копия рассылки: кому, куда, с каким poll_id.
 *
 * Строка создаётся при успешной отправке в чат получателя.
 * telegram_poll_id нужен, чтобы входящий poll_answer от Telegram
 * (там только poll.id без привязки к чату) сопоставить с рассылкой
 * и получателем и засчитать голос в статистику.
 *
 * @property int $id
 * @property int $broadcast_id рассылка (bot_broadcasts.id)
 * @property int $user_id получатель (users.id)
 * @property int $chat_id telegram_id чата
 * @property int|null $message_id id сообщения в чате
 * @property string|null $telegram_poll_id poll.id из sendPoll
 * @property array<int, int>|null $voted_option_ids последний голос
 */
class BotBroadcastMessage extends Model
{
    protected $fillable = [
        'broadcast_id',
        'user_id',
        'chat_id',
        'message_id',
        'telegram_poll_id',
        'voted_option_ids',
    ];

    protected $casts = [
        'chat_id' => 'integer',
        'message_id' => 'integer',
        'voted_option_ids' => 'array',
    ];

    /**
     * Рассылка-владелец копии.
     *
     * @return BelongsTo
     */
    public function broadcast(): BelongsTo
    {
        return $this->belongsTo(BotBroadcast::class, 'broadcast_id');
    }

    /**
     * Получатель копии.
     *
     * @return BelongsTo
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
