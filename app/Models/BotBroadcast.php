<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Рассылка админа всем пользователям Telegram-бота.
 *
 * Админ собирает пост прямо в боте (/publish): статья — красиво
 * оформленный лонгрид, опрос — нативный sendPoll. Публикация
 * разносит копию каждому в его чат с ботом фоновыми задачами,
 * голоса опросов стекаются через poll_answer в votes_count.
 *
 * @property int $id
 * @property string $type article|poll
 * @property string $title заголовок статьи
 * @property string|null $body текст статьи или пояснение под опросом
 * @property string|null $photo_url обложка статьи (https)
 * @property string|null $poll_question вопрос опроса
 * @property array<int, string>|null $poll_options варианты опроса
 * @property bool $poll_multiple несколько вариантов сразу
 * @property string $status draft|sending|sent|closed
 * @property int $sent_count скольким доставлено
 * @property int $failed_count скольким не доставлено
 * @property int $votes_count голосов всего (опросы)
 * @property int|null $created_by админ-автор (users.id)
 * @property \Illuminate\Support\Carbon|null $published_at
 */
class BotBroadcast extends Model
{
    protected $fillable = [
        'type',
        'title',
        'body',
        'photo_url',
        'poll_question',
        'poll_options',
        'poll_multiple',
        'status',
        'sent_count',
        'failed_count',
        'votes_count',
        'created_by',
        'published_at',
    ];

    protected $casts = [
        'poll_options' => 'array',
        'poll_multiple' => 'boolean',
        'sent_count' => 'integer',
        'failed_count' => 'integer',
        'votes_count' => 'integer',
        'published_at' => 'datetime',
    ];

    /**
     * Автор-админ рассылки.
     *
     * @return BelongsTo
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Доставленные копии по получателям (для статистики и голосов).
     *
     * @return HasMany
     */
    public function messages(): HasMany
    {
        return $this->hasMany(BotBroadcastMessage::class, 'broadcast_id');
    }

    /**
     * Последние опубликованные для ленты /news (сначала свежие).
     *
     * @param \Illuminate\Database\Eloquent\Builder $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopePublished($query)
    {
        return $query->where('status', 'sent')->orderByDesc('published_at');
    }

    /**
     * Это статья, а не опрос.
     *
     * @return bool
     */
    public function isArticle(): bool
    {
        return $this->type === 'article';
    }

    /**
     * Это опрос, а не статья.
     *
     * @return bool
     */
    public function isPoll(): bool
    {
        return $this->type === 'poll';
    }

    /**
     * Варианты опроса чистым списком строк.
     *
     * @return array<int, string>
     */
    public function pollOptions(): array
    {
        $options = $this->poll_options;

        if (! is_array($options)) {
            return [];
        }

        $clean = [];

        foreach ($options as $option) {
            $text = trim((string) $option);

            if ($text === '') {
                continue;
            }

            $clean[] = $text;
        }

        return array_values($clean);
    }
}
