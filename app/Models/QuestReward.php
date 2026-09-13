<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * История выдачи PRO за задания.
 *
 * @property int $id
 * @property int $user_id
 * @property string $track pins|swipes
 * @property string $cycle_key
 * @property \Carbon\Carbon $granted_at
 * @property \Carbon\Carbon $expires_at
 * @property \Carbon\Carbon $cooldown_until
 */
class QuestReward extends Model
{
    protected $fillable = [
        'user_id',
        'track',
        'cycle_key',
        'granted_at',
        'expires_at',
        'cooldown_until',
    ];

    protected function casts(): array
    {
        return [
            'granted_at' => 'datetime',
            'expires_at' => 'datetime',
            'cooldown_until' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
