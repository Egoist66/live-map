<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminImpersonationLog extends Model
{
    protected $fillable = ['admin_id', 'target_user_id', 'reason', 'ip', 'user_agent', 'started_at', 'ended_at', 'seen_at'];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'ended_at' => 'datetime', 'seen_at' => 'datetime'];
    }

    public function admin() { return $this->belongsTo(User::class, 'admin_id'); }
    public function target() { return $this->belongsTo(User::class, 'target_user_id'); }
}
