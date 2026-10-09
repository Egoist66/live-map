<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Отзыв о пользователе знакомств: звёзды 1–5 и короткий текст.
 *
 * Один автор — один отзыв на человека (unique author+target):
 * повторная отправка обновляет оценку. Оставить отзыв может
 * только тот, кто взаимодействовал: мэтч или direct-диалог
 * (писал сам, писали ему, начали общаться). Проверку делает
 * DatingReviewService::canReview, модель лишь хранит данные.
 *
 * @property int $id
 * @property int $author_id кто оценил
 * @property int $target_id кого оценили
 * @property int $rating звёзды 1–5
 * @property string|null $body текст до 280 символов
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class DatingReview extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['author_id', 'target_id', 'rating', 'body'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rating' => 'integer',
        ];
    }

    /**
     * Автор отзыва.
     *
     * @return BelongsTo
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /**
     * Получатель отзыва.
     *
     * @return BelongsTo
     */
    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_id');
    }
}
