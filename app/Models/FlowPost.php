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
 * @property int|null $business_id новость компании (пост от бренда, всегда в топе)
 * @property int|null $business_ad_id связь 1-к-1 с рекламой кабинета
 * @property int|null $repost_of_id
 * @property string|null $repost_comment
 * @property string|null $title
 * @property string $body
 * @property string|null $image_path
 * @property bool $is_anonymous
 * @property int $likes_count
 * @property int $comments_count
 * @property int $reposts_count
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class FlowPost extends Model
{
    protected $fillable = [
        'user_id',
        'business_id',
        'business_ad_id',
        'repost_of_id',
        'repost_comment',
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
     * Компания-автор новости (null — обычный пользовательский пост).
     */
    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    /**
     * Реклама кабинета, породившая пост (null — обычный пост).
     */
    public function businessAd(): BelongsTo
    {
        return $this->belongsTo(BusinessAd::class);
    }

    /**
     * Новость компании ли это (пост от бренда).
     *
     * @return bool true когда привязана компания
     */
    public function isCompanyNews(): bool
    {
        return $this->business_id !== null;
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
     * Оригинал репоста (null — обычный пост).
     */
    public function original(): BelongsTo
    {
        return $this->belongsTo(FlowPost::class, 'repost_of_id');
    }

    /**
     * Репосты этого поста.
     */
    public function reposts(): HasMany
    {
        return $this->hasMany(FlowPost::class, 'repost_of_id');
    }

    /**
     * Медиа поста по порядку (фото/видео).
     */
    public function media(): HasMany
    {
        return $this->hasMany(FlowPostMedia::class, 'post_id')->orderBy('sort_order');
    }

    /**
     * Опрос поста (один на пост).
     */
    public function poll(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(FlowPoll::class, 'post_id');
    }

    /**
     * Хэштеги поста.
     */
    public function tags(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'flow_post_tag', 'post_id', 'tag_id');
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
