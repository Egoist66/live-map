<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Прогресс задания пользователя за цикл.
 *
 * @property int $id
 * @property int $user_id
 * @property string $track pins|swipes
 * @property string $code
 * @property int $progress
 * @property int $target
 * @property bool $is_completed
 * @property \Carbon\Carbon|null $completed_at
 * @property string $cycle_key Y-m
 * @property bool $xp_awarded
 */
class UserQuestProgress extends Model
{
    protected $table = 'user_quest_progress';

    protected $fillable = [
        'user_id',
        'track',
        'code',
        'progress',
        'target',
        'is_completed',
        'completed_at',
        'cycle_key',
        'xp_awarded',
    ];

    protected function casts(): array
    {
        return [
            'is_completed' => 'boolean',
            'xp_awarded' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
