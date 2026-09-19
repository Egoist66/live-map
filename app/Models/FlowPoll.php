<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Опрос поста UFlow: один голос пользователя, опциональный дедлайн.
 *
 * @property int $id
 * @property int $post_id
 * @property \Carbon\Carbon|null $closes_at
 * @property bool $closed
 * @property int $total_votes
 */
class FlowPoll extends Model
{
    protected $fillable = [
        'post_id',
        'closes_at',
        'closed',
    ];

    /**
     * Пост-владелец.
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(FlowPost::class, 'post_id');
    }

    /**
     * Варианты ответа по порядку.
     */
    public function options(): HasMany
    {
        return $this->hasMany(FlowPollOption::class, 'poll_id')->orderBy('sort_order');
    }

    /**
     * Голоса опроса.
     */
    public function votes(): HasMany
    {
        return $this->hasMany(FlowPollVote::class, 'poll_id');
    }

    /**
     * Опрос закрыт вручную или по дедлайну.
     */
    public function isClosed(): bool
    {
        if ($this->closed) {
            return true;
        }

        if ($this->closes_at && $this->closes_at->isPast()) {
            return true;
        }

        return false;
    }

    protected function casts(): array
    {
        return [
            'closes_at' => 'datetime',
            'closed' => 'boolean',
        ];
    }
}
