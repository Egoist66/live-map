<?php

namespace App\Models;

use App\Services\MediaDisk;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Фото компании для витрины на карте и публичного профиля.
 *
 * @property int $id
 * @property int $business_id
 * @property string $path
 * @property string|null $caption
 * @property int $sort_order
 * @property-read string|null $url
 */
class BusinessPhoto extends Model
{
    protected $fillable = ['business_id', 'path', 'caption', 'sort_order'];

    protected $casts = ['sort_order' => 'integer'];

    protected $appends = ['url'];

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function getUrlAttribute(): ?string
    {
        return MediaDisk::url($this->path);
    }

    /**
     * @return array<string, mixed>
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url,
            'caption' => $this->caption,
        ];
    }
}
