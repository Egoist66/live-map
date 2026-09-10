<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PinActivity extends Model
{
    protected $fillable = [
        'pin_id', 'actor_id', 'owner_id', 'kind', 'reaction_type', 'comment_id', 'photo_id', 'photo_comment_id', 'related_user_id', 'is_incognito', 'excerpt', 'read_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
        'is_incognito' => 'boolean',
    ];

    public function pin(): BelongsTo { return $this->belongsTo(Pin::class); }
    public function actor(): BelongsTo { return $this->belongsTo(User::class, 'actor_id'); }
    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'owner_id'); }
    public function comment(): BelongsTo { return $this->belongsTo(PinComment::class, 'comment_id'); }
    public function photo(): BelongsTo { return $this->belongsTo(ProfilePhoto::class, 'photo_id'); }
    public function photoComment(): BelongsTo { return $this->belongsTo(ProfilePhotoComment::class, 'photo_comment_id'); }
    public function relatedUser(): BelongsTo { return $this->belongsTo(User::class, 'related_user_id'); }

    public function toNotifyArray(): array
    {
        $actor = $this->relationLoaded('actor') ? $this->actor : $this->actor()->first(['id', 'name', 'avatar_path']);
        $pin = $this->relationLoaded('pin') ? $this->pin : ($this->pin_id ? $this->pin()->first(['id', 'title', 'category']) : null);
        $photo = $this->relationLoaded('photo') ? $this->photo : ($this->photo_id ? $this->photo()->first(['id', 'user_id', 'caption']) : null);
        $actorPayload = $actor ? array_merge($actor->only(['id', 'name', 'avatar_path']), ['avatar_url' => $actor->avatar_url]) : ['id' => $this->actor_id];
        $isIncognito = (bool) $this->is_incognito;
        if ($isIncognito) {
            $actorPayload = ['id' => $this->actor_id, 'name' => 'Тайный поклонник', 'avatar_path' => null, 'avatar_url' => null];
        }
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'owner_id' => $this->owner_id,
            'reaction_type' => $this->reaction_type,
            'excerpt' => $this->excerpt,
            'comment_id' => $this->comment_id,
            'photo_comment_id' => $this->photo_comment_id,
            'related_user_id' => $this->related_user_id,
            'is_incognito' => (bool) $this->is_incognito,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
            'pin' => $pin ? ['id' => $pin->id, 'title' => $pin->title, 'category' => $pin->category] : ($this->pin_id ? ['id' => $this->pin_id] : null),
            'photo' => $photo ? ['id' => $photo->id, 'user_id' => $photo->user_id, 'caption' => $photo->caption] : ($this->photo_id ? ['id' => $this->photo_id] : null),
            'actor' => $actorPayload,
        ];
    }
}
