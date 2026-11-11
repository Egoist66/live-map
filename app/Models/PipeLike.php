<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Лайк в Pipe: один лайк на тред или на ответ от одного пользователя.
 *
 * Сущность определяют заполненные внешние ключи: thread_id — лайк
 * треда, reply_id — лайк ответа. Оба одновременно заполнить нельзя.
 *
 * @property int $id
 * @property int $user_id Кто лайкнул
 * @property int|null $thread_id Лайкнутый тред (или null)
 * @property int|null $reply_id Лайкнутый ответ (или null)
 * @property-read User|null $user Автор лайка
 * @property-read PipeThread|null $thread Лайкнутый тред
 * @property-read PipeReply|null $reply Лайкнутый ответ
 */
class PipeLike extends Model
{
    /** @var array<int,string> массово заполняемые поля */
    protected $fillable = ['user_id', 'thread_id', 'reply_id'];

    /** Кто лайкнул. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Лайкнутый тред. */
    public function thread(): BelongsTo
    {
        return $this->belongsTo(PipeThread::class, 'thread_id');
    }

    /** Лайкнутый ответ. */
    public function reply(): BelongsTo
    {
        return $this->belongsTo(PipeReply::class, 'reply_id');
    }
}
