<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Вариант ответа в опросе UFlow со счётчиком голосов.
 *
 * @property int $id
 * @property int $poll_id
 * @property string $text
 * @property int $votes_count
 * @property int $sort_order
 */
class FlowPollOption extends Model
{
    protected $fillable = [
        'poll_id',
        'text',
        'sort_order',
    ];

    /**
     * Опрос-владелец.
     */
    public function poll(): BelongsTo
    {
        return $this->belongsTo(FlowPoll::class, 'poll_id');
    }

    /**
     * Голоса за вариант.
     */
    public function votes(): HasMany
    {
        return $this->hasMany(FlowPollVote::class, 'option_id');
    }
}
