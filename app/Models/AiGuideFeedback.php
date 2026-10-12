<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Оценка ответа AI-гида пользователем.
 *
 * Сигнал для улучшения базы знаний: какие диалоги хвалят,
 * какие ругают. Не влияет на ответы напрямую (дообучения
 * free-моделей нет), используется при ревизии статей.
 *
 * @property int $id
 * @property int $user_id
 * @property string $conversation_id
 * @property int $rating 1 — помогло, -1 — не помогло
 * @property string|null $comment
 */
class AiGuideFeedback extends Model
{
    /**
     * @var string
     */
    protected $table = 'ai_guide_feedback';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'conversation_id',
        'rating',
        'comment',
    ];

    /**
     * Автор оценки.
     *
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
