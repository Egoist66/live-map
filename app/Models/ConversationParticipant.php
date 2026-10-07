<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationParticipant extends Model
{
    public $timestamps = false;
    protected $fillable = ['conversation_id','user_id','last_read_at','joined_at','hidden_at','cleared_at','pinned_at'];
    protected $casts = ['last_read_at' => 'datetime','joined_at' => 'datetime','hidden_at' => 'datetime','cleared_at' => 'datetime','pinned_at' => 'datetime'];
    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
