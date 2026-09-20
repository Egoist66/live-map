<?php

namespace App\Models;

use App\Casts\EncryptedTextCast;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PinComment extends Model
{
    use SoftDeletes;

    protected $fillable = ['pin_id', 'user_id', 'parent_id', 'content', 'is_anonymous'];

    protected $casts = ['is_anonymous' => 'boolean', 'content' => EncryptedTextCast::class];

    public function pin(): BelongsTo { return $this->belongsTo(Pin::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function parent(): BelongsTo { return $this->belongsTo(self::class, 'parent_id'); }
    public function replies(): HasMany { return $this->hasMany(self::class, 'parent_id'); }
    public function reactions() { return $this->morphMany(Reaction::class, 'reactable'); }
}
