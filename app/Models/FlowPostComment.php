<?php

namespace App\Models;

use App\Casts\EncryptedTextCast;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Комментарий к посту UFlow с поддержкой веток через parent_id.
 *
 * @property int $id
 * @property int $post_id
 * @property int $user_id
 * @property int|null $parent_id
 * @property string $content
 * @property bool $is_anonymous
 */
class FlowPostComment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'post_id',
        'user_id',
        'parent_id',
        'content',
        'is_anonymous',
    ];

    protected $casts = [
        'is_anonymous' => 'boolean',
        'content' => EncryptedTextCast::class,
    ];

    /**
     * Пост-владелец.
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(FlowPost::class, 'post_id');
    }

    /**
     * Автор комментария.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Родительский комментарий для ответов.
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /**
     * Ответы на комментарий.
     */
    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id');
    }
}
