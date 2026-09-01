<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Business extends Model
{
    protected $fillable = ['user_id', 'name', 'category', 'address', 'lat', 'lng', 'description', 'phone', 'website', 'working_hours', 'subscription_plan', 'is_active'];
    protected $casts = ['lat' => 'decimal:7', 'lng' => 'decimal:7', 'working_hours' => 'array', 'is_active' => 'boolean'];
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
