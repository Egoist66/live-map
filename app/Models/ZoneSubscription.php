<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ZoneSubscription extends Model
{
    protected $fillable = ['user_id', 'lat', 'lng', 'radius_km', 'types', 'notify_via'];
    protected $casts = ['lat' => 'decimal:7', 'lng' => 'decimal:7', 'types' => 'array'];
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
