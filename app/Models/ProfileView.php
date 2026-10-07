<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Просмотр чужого профиля.
 *
 * Пишется при открытии /users/{slug} другим пользователем
 * (см. ProfileStatsService::recordView). Гость — viewer_id null.
 * Дедуп: один viewer → один viewed в сутки (защита от накруток
 * обновлением страницы).
 *
 * @property int $id
 * @property int $viewed_id
 * @property int|null $viewer_id
 * @property \Carbon\Carbon $created_at
 */
class ProfileView extends Model
{
    public $timestamps = false;

    protected $fillable = ['viewed_id', 'viewer_id', 'created_at'];

    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    public function viewed(): BelongsTo
    {
        return $this->belongsTo(User::class, 'viewed_id');
    }

    public function viewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'viewer_id');
    }
}
