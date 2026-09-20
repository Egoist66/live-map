<?php

namespace App\Models;

use App\Casts\EncryptedTextCast;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProfilePhotoComment extends Model
{
    protected $fillable = ['photo_id', 'user_id', 'content'];

    protected $casts = [
        'content' => EncryptedTextCast::class,
    ];

    public function photo(): BelongsTo { return $this->belongsTo(ProfilePhoto::class, 'photo_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
