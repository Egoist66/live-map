<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Обращение пользователя в поддержку.
 *
 * Создаётся из формы настроек (SupportController::store), разбирается
 * в админке «Обращения»: ответить (письмо пользователю) или отклонить.
 * Статусы: new — ждёт разбора, answered — дан ответ, rejected — закрыто.
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $name
 * @property string $email
 * @property string $subject
 * @property string $message
 * @property string $status
 * @property string|null $admin_reply
 * @property int|null $replied_by
 * @property \Carbon\Carbon|null $replied_at
 */
class SupportTicket extends Model
{
    public const STATUS_NEW = 'new';

    public const STATUS_ANSWERED = 'answered';

    public const STATUS_REJECTED = 'rejected';

    /** @var string[] */
    public const STATUSES = [self::STATUS_NEW, self::STATUS_ANSWERED, self::STATUS_REJECTED];

    protected $fillable = [
        'user_id',
        'name',
        'email',
        'subject',
        'message',
        'status',
        'admin_reply',
        'replied_by',
        'replied_at',
    ];

    protected $casts = [
        'replied_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function replier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replied_by');
    }

    /**
     * Открыт ли тикет (ждёт разбора).
     */
    public function isNew(): bool
    {
        return $this->status === self::STATUS_NEW;
    }

    /**
     * Человеческая подпись статуса для админки.
     */
    public static function statusLabel(string $status): string
    {
        return match ($status) {
            self::STATUS_NEW => 'Новое',
            self::STATUS_ANSWERED => 'Отвечено',
            self::STATUS_REJECTED => 'Отклонено',
            default => $status,
        };
    }
}
