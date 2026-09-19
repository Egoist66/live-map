<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Медиа поста UFlow: фото (до 4) или одно видео.
 *
 * @property int $id
 * @property int $post_id
 * @property string $kind
 * @property string $path
 * @property int $sort_order
 * @property int|null $duration_sec
 */
class FlowPostMedia extends Model
{
    protected $table = 'flow_post_media';

    protected $fillable = [
        'post_id',
        'kind',
        'path',
        'sort_order',
        'duration_sec',
    ];

    protected $appends = ['url'];

    /**
     * Пост-владелец.
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(FlowPost::class, 'post_id');
    }

    /**
     * Публичный URL файла или null.
     */
    protected function url(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (! $this->path) {
                return null;
            }

            $disk = User::avatarDisk();

            return Storage::disk($disk)->url($this->path);
        });
    }
}
