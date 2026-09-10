<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Приглашение посмотреть пин вне зоны/страны.
 *
 * Автор пина может явно пригласить пользователя — тогда
 * страна и домашняя зона не блокируют просмотр.
 *
 * @property int $id
 * @property int $pin_id
 * @property int $inviter_id
 * @property int $invitee_id
 * @property string $status
 */
class PinInvite extends Model
{
    protected $fillable = ['pin_id', 'inviter_id', 'invitee_id', 'status'];

    public function pin(): BelongsTo { return $this->belongsTo(Pin::class); }
    public function inviter(): BelongsTo { return $this->belongsTo(User::class, 'inviter_id'); }
    public function invitee(): BelongsTo { return $this->belongsTo(User::class, 'invitee_id'); }
}
