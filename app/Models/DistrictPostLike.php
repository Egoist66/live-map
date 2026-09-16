<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Лайк новости района (один житель — один лайк).
 *
 * @property int $id
 * @property int $post_id
 * @property int $user_id
 */
class DistrictPostLike extends Model
{
    protected $fillable = ['post_id', 'user_id'];

    public function post(): BelongsTo
    {
        return $this->belongsTo(DistrictPost::class, 'post_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
