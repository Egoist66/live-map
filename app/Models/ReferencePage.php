<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Справочная страница сайта (контакты, политика, оферта).
 *
 * @property int $id
 * @property string $slug
 * @property string $title
 * @property string|null $body
 * @property array|null $meta
 * @property array|null $attachments
 * @property bool $is_published
 * @property \Carbon\Carbon|null $published_at
 */
class ReferencePage extends Model
{
    public const SLUG_CONTACTS = 'contacts';

    public const SLUG_PRIVACY = 'privacy';

    public const SLUG_OFFER = 'offer';

    protected $fillable = [
        'slug',
        'title',
        'body',
        'meta',
        'attachments',
        'is_published',
        'published_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'meta' => 'array',
        'attachments' => 'array',
        'is_published' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @param \Illuminate\Database\Eloquent\Builder $query
     */
    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    /**
     * @param \Illuminate\Database\Eloquent\Builder $query
     */
    public function scopeBySlug($query, string $slug)
    {
        return $query->where('slug', $slug);
    }

    public static function allowedSlugs(): array
    {
        return [
            self::SLUG_CONTACTS,
            self::SLUG_PRIVACY,
            self::SLUG_OFFER,
        ];
    }
}
