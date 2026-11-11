<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Сохранённый (избранный) тред Pipe: личная закладка пользователя.
 *
 * Аналог pipe_likes, но приватная сущность: закладки видит только
 * владелец (вкладка «Избранные»), автору уведомления не уходят.
 *
 * @property int $id
 * @property int $user_id Владелец закладки
 * @property int $thread_id Сохранённый тред
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read User $user Владелец закладки
 * @property-read PipeThread $thread Сохранённый тред
 */
class PipeSave extends Model
{
    /** @var array<int,string> массово заполняемые поля */
    protected $fillable = ['user_id', 'thread_id'];

    /** Владелец закладки. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Сохранённый тред. */
    public function thread(): BelongsTo
    {
        return $this->belongsTo(PipeThread::class);
    }

    /** Сохранил ли пользователь тред. */
    public static function existsBetween(int $userId, int $threadId): bool
    {
        return self::where('user_id', $userId)
            ->where('thread_id', $threadId)
            ->exists();
    }
}
