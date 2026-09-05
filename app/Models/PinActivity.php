<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PinActivity extends Model
{
    protected $fillable = [
        'pin_id', 'actor_id', 'owner_id', 'kind', 'reaction_type', 'comment_id', 'excerpt', 'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
    ];

    public function pin(): BelongsTo { return $this->belongsTo(Pin::class); }
    public function actor(): BelongsTo { return $this->belongsTo(User::class, 'actor_id'); }
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function comment(): BelongsTo { return $this->belongsTo(PinComment::class, 'comment_id'); }

    public function toNotifyArray(): array
    {
        $actor = $this->relationLoaded('actor') ? $this->actor : $this->actor()->first(['id', 'name', 'avatar_path']);
        $pin = $this->relationLoaded('pin') ? $this->pin : $this->pin()->first(['id', 'title', 'category']);
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'reaction_type' => $this->reaction_type,
            'excerpt' => $this->excerpt,
            'comment_id' => $this->comment_id,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
            'pin' => $pin ? ['id' => $pin->id, 'title' => $pin->title, 'category' => $pin->category] : ['id' => $this->pin_id],
            'actor' => $actor ? array_merge($actor->only(['id', 'name', 'avatar_path']), ['avatar_url' => $actor->avatar_url]) : ['id' => $this->actor_id],
        ];
    }
}
