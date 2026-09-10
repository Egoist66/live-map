<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfilePhotoLike extends Model
{
    protected $fillable = ['photo_id', 'user_id', 'is_incognito'];

    protected function casts(): array
    {
        return ['is_incognito' => 'boolean'];
    }

    public function photo(): BelongsTo { return $this->belongsTo(ProfilePhoto::class, 'photo_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
