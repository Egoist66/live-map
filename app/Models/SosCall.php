<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * SOS-вызов: экстренный пин в ожидании помощи.
 *
 * Создаётся вместе с SOS-пином в статусе pending. Первый принявший
 * становится responder, вызов переходит в active и получает отдельный чат.
 * Закрывается удалением пина (каскад).
 *
 * @property int $id
 * @property int $pin_id
 * @property int $creator_id
 * @property int|null $responder_id
 * @property string $status pending|active|closed
 * @property int|null $conversation_id
 */
class SosCall extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'pin_id',
        'creator_id',
        'responder_id',
        'status',
        'conversation_id',
    ];

    public function pin(): BelongsTo
    {
        return $this->belongsTo(Pin::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responder_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function declines(): HasMany
    {
        return $this->hasMany(SosCallDecline::class, 'sos_call_id');
    }

    /**
     * Участвует ли пользователь в вызове (создатель или принявший).
     *
     * @param int $userId
     * @return bool
     */
    public function isParticipant(int $userId): bool
    {
        return (int) $this->creator_id === $userId || (int) $this->responder_id === $userId;
    }

    /**
     * Активен ли вызов (ожидает или в работе).
     *
     * @return bool
     */
    public function isLive(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_ACTIVE], true);
    }
}
