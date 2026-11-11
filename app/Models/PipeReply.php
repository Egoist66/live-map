<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Ответ (reply) треда Pipe — древовидное сообщение до 300 символов.
 *
 * parent_id пустой у ответов первого уровня; вложенность любой глубины
 * рисуется рекурсивно — ветка целиком приходит из API ответов треда.
 * Анонимность видимости автора — как у тредов, решается сериализацией.
 *
 * @property int $id
 * @property int $thread_id
 * @property int|null $parent_id
 * @property int $user_id
 * @property string $body Текст ответа (до 300 символов)
 * @property bool $is_anonymous
 * @property bool $is_pinned Закреплён автором треда (как в Instagram)
 * @property \Illuminate\Support\Carbon|null $pinned_at Когда закреплён
 * @property int $likes_count Денормализованный счётчик лайков
 * @property string|null $moderation_category Категория авто-модерации
 * @property-read PipeThread $thread Тред-родитель
 * @property-read PipeReply|null $parent Родительский ответ
 * @property-read \Illuminate\Support\Collection $children Вложенные ответы
 *
 * @method static Builder threadLevel() Только ответы первого уровня
 */
class PipeReply extends Model
{
    /** @var array<int,string> массово заполняемые поля */
    protected $fillable = ['thread_id', 'parent_id', 'user_id', 'body', 'is_anonymous', 'is_pinned', 'moderation_category'];

    /**
     * Касты счётчиков и флагов.
     *
     * @return array<string,string>
     */
    protected function casts(): array
    {
        return [
            'is_anonymous' => 'boolean',
            'is_pinned' => 'boolean',
            'likes_count' => 'integer',
        ];
    }

    /** Тред, к которому относится ответ. */
    public function thread(): BelongsTo
    {
        return $this->belongsTo(PipeThread::class, 'thread_id');
    }

    /** Родительский ответ (для вложенных ответов). */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    /** Автор ответа. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Вложенные ответы (дети). */
    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('id');
    }

    /** Лайки ответа. */
    public function likes(): HasMany
    {
        return $this->hasMany(PipeLike::class, 'reply_id');
    }

    /** Поставил ли user лайк ответу. */
    public function likedBy(int $userId): bool
    {
        return PipeLike::where('reply_id', $this->id)->where('user_id', $userId)->exists();
    }

    /** Ответы первого уровня (без parent_id). */
    public function scopeThreadLevel(Builder $query): Builder
    {
        return $query->whereNull('parent_id');
    }
}
