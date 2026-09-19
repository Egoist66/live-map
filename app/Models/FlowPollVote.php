<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Голос пользователя в опросе UFlow (один на опрос).
 *
 * @property int $id
 * @property int $poll_id
 * @property int $option_id
 * @property int $user_id
 */
class FlowPollVote extends Model
{
    protected $fillable = [
        'poll_id',
        'option_id',
        'user_id',
    ];

    /**
     * Опрос.
     */
    public function poll(): BelongsTo
    {
        return $this->belongsTo(FlowPoll::class, 'poll_id');
    }

    /**
     * Выбранный вариант.
     */
    public function option(): BelongsTo
    {
        return $this->belongsTo(FlowPollOption::class, 'option_id');
    }

    /**
     * Проголосовавший.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
