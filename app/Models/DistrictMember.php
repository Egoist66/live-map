<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Участник UDistrict: заявка (pending), одобренный житель (approved)
 * или исходящее приглашение владельца (invited — ждёт ответа).
 *
 * message — цель вступления из заявки (организации — обязательно,
 * персоны — по желанию). Видит только владелец в табе «Заявки».
 *
 * @property int $id
 * @property int $district_id
 * @property int $user_id
 * @property string $status pending|approved|invited
 * @property string|null $message цель вступления (до 500 символов)
 */
class DistrictMember extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_INVITED = 'invited';

    protected $fillable = ['district_id', 'user_id', 'status', 'message'];

    public function district(): BelongsTo { return $this->belongsTo(District::class); }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
