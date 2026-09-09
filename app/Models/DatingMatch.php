<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Взаимный мэтч двух пользователей.
 *
 * Инвариант: user_a_id < user_b_id, пара уникальна.
 * Мэтч открывает личный чат мимо квоты рандомных сообщений.
 *
 * @property int $id
 * @property int $user_a_id
 * @property int $user_b_id
 */
class DatingMatch extends Model
{
    protected $fillable = ['user_a_id', 'user_b_id'];

    public function userA(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_a_id');
    }

    public function userB(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_b_id');
    }

    /**
     * Нормализованная пара (меньший id первым).
     *
     * @param int $a
     * @param int $b
     * @return array{0:int,1:int}
     */
    public static function orderedPair(int $a, int $b): array
    {
        return $a < $b ? [$a, $b] : [$b, $a];
    }

    /**
     * Найти мэтч между двумя пользователями.
     *
     * @param int $a
     * @param int $b
     * @return self|null
     */
    public static function between(int $a, int $b): ?self
    {
        [$low, $high] = self::orderedPair($a, $b);

        return static::where('user_a_id', $low)
            ->where('user_b_id', $high)
            ->first();
    }

    /**
     * Другой участник мэтча.
     *
     * @param int $userId
     * @return User
     */
    public function otherUser(int $userId): User
    {
        return $this->user_a_id === $userId ? $this->userB : $this->userA;
    }
}
