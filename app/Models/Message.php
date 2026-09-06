<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Message extends Model
{
    protected $fillable = ['conversation_id','sender_id','body','type','read_at','delivered_at','edited_at','pinned_at','pinned_by'];
    protected $casts = ['read_at' => 'datetime', 'delivered_at' => 'datetime', 'edited_at' => 'datetime', 'pinned_at' => 'datetime'];

    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }
    public function sender(): BelongsTo { return $this->belongsTo(User::class,'sender_id'); }

    public function statusFor(?int $viewerId = null): string
    {
        if ($this->read_at) return 'read';
        if ($this->delivered_at) return 'delivered';
        return 'sent';
    }

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
            'delivered_at' => $this->delivered_at?->toISOString(),
            'read_at' => $this->read_at?->toISOString(),
            'status' => $this->statusFor(),
            'is_edited' => $this->edited_at !== null,
            'is_pinned' => $this->pinned_at !== null,
            'pinned_at' => $this->pinned_at?->toISOString(),
            'pinned_by' => $this->pinned_by,
            'sender' => $this->relationLoaded('sender') ? [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_path' => $this->sender->avatar_path,
                'avatar_url' => $this->sender->avatar_url,
            ] : null,
        ];
    }
}
