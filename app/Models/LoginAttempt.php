<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoginAttempt extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'email', 'user_id', 'ip', 'country', 'country_code', 'city', 'user_agent', 'successful',
    ];

    protected $casts = [
        'successful' => 'boolean',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
