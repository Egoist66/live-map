<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PinView extends Model
{
    protected $fillable = ['pin_id','user_id','ip'];
    public function pin(): BelongsTo { return $this->belongsTo(Pin::class); }
}
