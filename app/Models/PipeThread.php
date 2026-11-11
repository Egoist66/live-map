<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Тред ленты Pipe (pipe.ulove.by) — короткий пост про отношения/встречи.
 *
 * Анонимность видимости автора решается на сериализации: свой пост и
 * staff видят реального автора, остальные — «Аноним». Счётчики лайков
 * и ответов хранятся денормализованно, жалобы через auto-модерацию
 * выставляют moderation_category.
 *
 * @property int $id
 * @property int $user_id
 * @property string $body Текст треда (до 500 символов)
 * @property bool $is_anonymous Анонимное ли сообщение
 * @property int $likes_count Денормализованный счётчик лайков
 * @property int $replies_count Денормализованный счётчик ответов
 * @property string|null $moderation_category Категория авто-модерации
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read User|null $user Автор треда
 * @property-read \Illuminate\Support\Collection $replies Ответы первого уровня
 * @property-read \Illuminate\Support\Collection<int, PipeThreadMedia> $media Картинки треда (до 3)
 *
 * @method static Builder forAuthor(int $authorId) Треды одного автора
 */
class PipeThread extends Model
{
    /** @var array<int,string> массово заполняемые поля */
    protected $fillable = ['user_id', 'body', 'is_anonymous', 'moderation_category'];

    /**
     * Касты счётчиков и флага анонимности.
     *
     * @return array<string,string>
     */
    protected function casts(): array
    {
        return [
            'is_anonymous' => 'boolean',
            'likes_count' => 'integer',
            'replies_count' => 'integer',
        ];
    }

    /** Автор треда. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Ответы первого уровня (без вложенных — ветки тянутся отдельно). */
    public function replies(): HasMany
    {
        return $this->hasMany(PipeReply::class, 'thread_id')->whereNull('parent_id');
    }

    /** Картинки треда в порядке добавления (до 3). */
    public function media(): HasMany
    {
        return $this->hasMany(PipeThreadMedia::class, 'thread_id')->orderBy('sort_order');
    }

    /** Все ответы треда любого уровня вложенности. */
    public function allReplies(): HasMany
    {
        return $this->hasMany(PipeReply::class, 'thread_id');
    }

    /** Лайки треда. */
    public function likes(): HasMany
    {
        return $this->hasMany(PipeLike::class, 'thread_id');
    }

    /** Поставил ли user лайк. */
    public function likedBy(int $userId): bool
    {
        return PipeLike::where('thread_id', $this->id)->where('user_id', $userId)->exists();
    }

    /** Принадлежит ли тред просматривающему. */
    public function ownedBy(?User $viewer): bool
    {
        return $viewer && (int) $viewer->id === (int) $this->user_id;
    }

    /** Блокировка схлопывания простыней: треды отсортированные по дате. */
    public function scopeLatest(Builder $query): Builder
    {
        return $query->orderByDesc('id');
    }

    /** Фильтр по автору. */
    public function scopeForAuthor(Builder $query, int $authorId): Builder
    {
        return $query->where('user_id', $authorId);
    }
}
