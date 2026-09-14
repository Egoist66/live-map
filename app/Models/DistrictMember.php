<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Участник UDistrict: заявка (pending) или одобренный житель (approved).
 *
 * @property int $id
 * @property int $district_id
 * @property int $user_id
 * @property string $status pending|approved
 */
class DistrictMember extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';

    protected $fillable = ['district_id', 'user_id', 'status'];

    public function district(): BelongsTo { return $this->belongsTo(District::class); }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
