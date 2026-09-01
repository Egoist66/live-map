<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $fillable = ['reporter_id', 'target_type', 'target_id', 'reason', 'description', 'status', 'moderator_id', 'resolved_at'];
    protected $casts = ['resolved_at' => 'datetime'];
    public function reporter(): BelongsTo { return $this->belongsTo(User::class, 'reporter_id'); }
    public function moderator(): BelongsTo { return $this->belongsTo(User::class, 'moderator_id'); }
}
