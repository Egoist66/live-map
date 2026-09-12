<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Notifications\DatabaseNotification;

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

    public function scopePublished($q)
    {
        return $q->where('is_published', true);
    }

    /**
     * Сколько пользователей прочитало новость (прочтения живут в inbox).
     */
    public function readsCount(): int
    {
        try {
            return DatabaseNotification::where('type', 'app.published')
                ->where('data->update_id', $this->id)
                ->whereNotNull('read_at')
                ->count();
        } catch (\Throwable) {
            return 0;
        }
    }
}
