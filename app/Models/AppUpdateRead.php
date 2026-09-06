<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AppUpdateRead extends Model
{
    public $timestamps = false;

    protected $fillable = ['app_update_id', 'user_id', 'read_at'];

    protected $casts = ['read_at' => 'datetime'];

    public function update_(): BelongsTo
    {
        return $this->belongsTo(AppUpdate::class, 'app_update_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
