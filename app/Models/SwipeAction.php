<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Лайк/пас в дейтинг-ленте.
 *
 * Одна запись на пару (liker_id, liked_id).
 * Взаимные `like` превращаются в DatingMatch через DatingService.
 *
 * @property int $id
 * @property int $liker_id
 * @property int $liked_id
 * @property string $action like|pass
 * @property bool $is_incognito
 * @property bool $is_superlike
 */
class SwipeAction extends Model
{
    protected $fillable = ['liker_id', 'liked_id', 'action', 'is_incognito', 'is_superlike'];

    protected function casts(): array
    {
        return ['is_incognito' => 'boolean', 'is_superlike' => 'boolean'];
    }

    public function liker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'liker_id');
    }

    public function liked(): BelongsTo
    {
        return $this->belongsTo(User::class, 'liked_id');
    }
}
