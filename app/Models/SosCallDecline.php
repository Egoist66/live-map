<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Отказ пользователя от SOS-вызова (скрыть, не участвовать).
 *
 * @property int $id
 * @property int $sos_call_id
 * @property int $user_id
 */
class SosCallDecline extends Model
{
    protected $fillable = ['sos_call_id', 'user_id'];

    public function call(): BelongsTo
    {
        return $this->belongsTo(SosCall::class, 'sos_call_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
