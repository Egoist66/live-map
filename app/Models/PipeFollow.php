<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Подписка внутри Pipe: кто на кого читает треды.
 *
 * Отдельная сущность (не Friendship/UserSubscription): Pipe —
 * свой Threads-подобный микроклимат для темы отношений.
 *
 * @property int $id
 * @property int $follower_id Читающий
 * @property int $following_id Читаемый
 * @property-read User|null $follower Читающий пользователь
 * @property-read User|null $following Читаемый пользователь
 */
class PipeFollow extends Model
{
    /** @var array<int,string> массово заполняемые поля */
    protected $fillable = ['follower_id', 'following_id'];

    /** Кто читает. */
    public function follower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'follower_id');
    }

    /** Кого читает. */
    public function following(): BelongsTo
    {
        return $this->belongsTo(User::class, 'following_id');
    }

    /** Подписан ли $followerId на $followingId. */
    public static function existsBetween(int $followerId, int $followingId): bool
    {
        return self::where('follower_id', $followerId)
            ->where('following_id', $followingId)
            ->exists();
    }
}
