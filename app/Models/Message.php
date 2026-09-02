<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    protected $fillable = ['conversation_id','sender_id','body','type','read_at','edited_at'];
    protected $casts = ['read_at' => 'datetime', 'edited_at' => 'datetime'];

    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }
    public function sender(): BelongsTo { return $this->belongsTo(User::class,'sender_id'); }

    public function toArrayPayload(): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'sender_id' => $this->sender_id,
            'body' => $this->body,
            'type' => $this->type,
            'created_at' => $this->created_at?->toISOString(),
            'edited_at' => $this->edited_at?->toISOString(),
            'is_edited' => $this->edited_at !== null,
            'sender' => $this->relationLoaded('sender') ? [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_path' => $this->sender->avatar_path,
            ] : null,
        ];
    }
}
