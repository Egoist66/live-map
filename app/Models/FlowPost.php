<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Storage;

/**
 * Пост ленты UFlow: новость пользователя, видимая всем.
 *
 * Анонимность: автор всегда сохраняется в user_id, но при
 * is_anonymous=true имя и аватар скрываются от чужих.
 *
 * @property int $id
 * @property int $user_id
 * @property string|null $title
 * @property string $body
 * @property string|null $image_path
 * @property bool $is_anonymous
 * @property int $likes_count
 * @property int $comments_count
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class FlowPost extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'body',
        'image_path',
        'is_anonymous',
    ];

    protected $appends = ['image_url'];

    /**
     * Автор поста.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Комментарии верхнего уровня и ответы.
     */
    public function comments(): HasMany
    {
        return $this->hasMany(FlowPostComment::class, 'post_id');
    }

    /**
     * Лайки поста.
     */
    public function likes(): HasMany
    {
        return $this->hasMany(FlowPostLike::class, 'post_id');
    }

    /**
     * Публичный URL картинки или null.
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (! $this->image_path) {
                return null;
            }

            $disk = User::avatarDisk();

            return Storage::disk($disk)->url($this->image_path);
        });
    }

    protected function casts(): array
    {
        return [
            'is_anonymous' => 'boolean',
        ];
    }
}
