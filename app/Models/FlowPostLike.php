<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Лайк поста UFlow: один пользователь — один лайк на пост.
 *
 * @property int $id
 * @property int $post_id
 * @property int $user_id
 */
class FlowPostLike extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'post_id',
        'user_id',
    ];

    /**
     * Пост.
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(FlowPost::class, 'post_id');
    }

    /**
     * Кто лайкнул.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
