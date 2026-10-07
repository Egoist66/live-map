<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Время пользователя в приложении по дням.
 *
 * Копит ChatUserController::heartbeat: если с прошлого
 * last_seen_at прошло меньше 5 минут — считаем, что человек
 * был онлайн всё это время, и докладываем дельту в секунды
 * сегодняшнего дня. История — для вкладки «Статистика».
 *
 * @property int $id
 * @property int $user_id
 * @property string $day Y-m-d
 * @property int $seconds
 */
class AppTimeLog extends Model
{
    protected $fillable = ['user_id', 'day', 'seconds'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
