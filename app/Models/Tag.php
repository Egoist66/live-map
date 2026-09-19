<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Хэштег ленты UFlow (имя в нижнем регистре, уникальное).
 *
 * @property int $id
 * @property string $name
 * @property int $posts_count
 */
class Tag extends Model
{
    protected $fillable = [
        'name',
    ];

    /**
     * Посты с тегом.
     */
    public function flowPosts(): BelongsToMany
    {
        return $this->belongsToMany(FlowPost::class, 'flow_post_tag', 'tag_id', 'post_id');
    }
}
