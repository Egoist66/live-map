<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Голосовой звонок 1-1: направленный звонок по мэтчу или пара из рулетки.
 *
 * Жизненный цикл: ringing → active → ended | declined | timeout | busy.
 * Звонок ringing старше RING_TTL_SEC считается протухшим (лениво гасится
 * при следующем обращении, отдельный cron не требуется).
 *
 * @property int $id
 * @property string $mode match|roulette
 * @property bool $audio_only голосовой звонок без камеры
 * @property int $caller_id
 * @property int $callee_id
 * @property int|null $match_id
 * @property string $status
 * @property \Carbon\Carbon|null $started_at
 * @property \Carbon\Carbon|null $ended_at
 */
class VideoCall extends Model
{
    public const MODE_MATCH = 'match';

    public const MODE_ROULETTE = 'roulette';

    /** Прямой звонок другу без мэтча (accepted-дружба). */
    public const MODE_DIRECT = 'direct';

    public const STATUS_RINGING = 'ringing';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_DECLINED = 'declined';

    public const STATUS_ENDED = 'ended';

    public const STATUS_TIMEOUT = 'timeout';

    public const STATUS_BUSY = 'busy';

    /** Сколько секунд висит ringing до авто-таймаута. */
    public const RING_TTL_SEC = 40;

    protected $fillable = [
        'mode',
        'audio_only',
        'caller_id',
        'callee_id',
        'match_id',
        'status',
        'started_at',
        'ended_at',
    ];

    protected $casts = [
        'started_at' => 'datetime',
        'ended_at' => 'datetime',
    ];

    public function caller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'caller_id');
    }

    public function callee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'callee_id');
    }

    public function signals(): HasMany
    {
        return $this->hasMany(VideoSignal::class, 'call_id')->orderBy('id');
    }

    /**
     * Участник ли пользователь этого звонка.
     *
     * @param int $userId пользователь
     * @return bool
     */
    public function involves(int $userId): bool
    {
        return $this->caller_id === $userId || $this->callee_id === $userId;
    }

    /**
     * Id собеседника.
     *
     * @param int $userId смотрящий
     * @return int
     */
    public function peerId(int $userId): int
    {
        return $this->caller_id === $userId ? (int) $this->callee_id : (int) $this->caller_id;
    }

    /**
     * Живой ли звонок (можно слать сигналы).
     *
     * @return bool
     */
    public function isLive(): bool
    {
        return in_array($this->status, [self::STATUS_RINGING, self::STATUS_ACTIVE], true);
    }
}
