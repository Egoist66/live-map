<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AppUpdate extends Model
{
    protected $fillable = ['title', 'body', 'version', 'is_published', 'published_at', 'created_by'];

    protected $casts = [
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(AppUpdateRead::class);
    }

    public function scopePublished($q)
    {
        return $q->where('is_published', true);
    }

    public function isReadBy(?User $user): bool
    {
        if (! $user) return false;
        return $this->reads()->where('user_id', $user->id)->exists();
    }

    public function toArrayWithRead(?User $user = null): array
    {
        return array_merge($this->toArray(), [
            'is_read' => $user ? $this->isReadBy($user) : false,
            'reads_count' => $this->reads()->count(),
        ]);
    }
}
