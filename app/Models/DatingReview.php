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
 * @property string $status pending|approved|rejected (модерация)
 * @property int|null $moderator_id кто одобрил/отклонил
 * @property \Carbon\Carbon|null $moderated_at когда решение принято
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class DatingReview extends Model
{
    /** Ожидает проверки модератором. */
    public const STATUS_PENDING = 'pending';

    /** Одобрен и виден другим. */
    public const STATUS_APPROVED = 'approved';

    /** Отклонён модератором. */
    public const STATUS_REJECTED = 'rejected';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'author_id',
        'target_id',
        'rating',
        'body',
        'status',
        'moderator_id',
        'moderated_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'moderated_at' => 'datetime',
        ];
    }

    /**
     * Отзыв уже одобрен: виден в сводках и списках.
     *
     * @return bool
     */
    public function isApproved(): bool
    {
        return $this->status === self::STATUS_APPROVED;
    }

    /**
     * Краткая форма для пейлоада уведомлений.
     *
     * @param User|null $target получатель оценки (для имена)
     * @return array<string,mixed>
     */
    public function toNotifyArray(?User $target = null): array
    {
        return [
            'id' => (int) $this->id,
            'status' => (string) $this->status,
            'rating' => (int) $this->rating,
            'excerpt' => $this->body ? mb_substr($this->body, 0, 120) : null,
            'author_name' => $this->author->name ?? 'Пользователь',
            'target_name' => $target?->name ?? $this->target->name ?? null,
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
