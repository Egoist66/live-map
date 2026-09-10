<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Подписка пользователя на обновления другого пользователя.
 *
 * @property int $id
 * @property int $subscriber_id
 * @property int $target_id
 * @property bool $notify_pin
 * @property bool $notify_photo
 * @property bool $notify_level
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class UserSubscription extends Model
{
    use HasFactory;

    protected $fillable = [
        'subscriber_id',
        'target_id',
        'notify_pin',
        'notify_photo',
        'notify_level',
    ];

    protected function casts(): array
    {
        return [
            'notify_pin' => 'boolean',
            'notify_photo' => 'boolean',
            'notify_level' => 'boolean',
        ];
    }

    /**
     * Кто подписался.
     */
    public function subscriber(): BelongsTo
    {
        return $this->belongsTo(User::class, 'subscriber_id');
    }

    /**
     * На кого подписались.
     */
    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_id');
    }
}
