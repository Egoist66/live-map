<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PinBoost extends Model
{
    protected $fillable = ['pin_id','user_id','type','duration_hours','price','starts_at','ends_at'];
    protected $casts = ['starts_at'=>'datetime','ends_at'=>'datetime','price'=>'decimal:2'];
    public function pin(): BelongsTo { return $this->belongsTo(Pin::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
