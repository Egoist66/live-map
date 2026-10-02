<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Storage;

class ProfilePhoto extends Model
{
    protected $fillable = ['user_id', 'path', 'thumb_path', 'caption', 'sort_order'];

    protected $appends = ['url', 'thumb_url'];

    protected function url(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (!$this->path) return null;
            $disk = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket') ? 's3' : 'public';
            $url = Storage::disk($disk)->url($this->path);
            if ($disk === 'public') {
                $parts = parse_url($url);
                if (!empty($parts['path'])) {
                    $url = $parts['path'] . (isset($parts['query']) ? '?' . $parts['query'] : '');
                }
            }
            return self::versionedUrl($url, $this->updated_at?->timestamp);
        });
    }

    /**
     * URL превью 480px для сетки галереи.
     *
     * Превью нет (старые фото, генерация не удалась) — null, фронт
     * откатывается на полный `url`. Диск тот же, что у оригинала.
     */
    protected function thumbUrl(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (! $this->thumb_path) {
                return null;
            }

            $disk = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket') ? 's3' : 'public';
            $url = Storage::disk($disk)->url($this->thumb_path);

            if ($disk === 'public') {
                $parts = parse_url($url);

                if (! empty($parts['path'])) {
                    $url = $parts['path'].(isset($parts['query']) ? '?'.$parts['query'] : '');
                }
            }

            return self::versionedUrl($url, $this->updated_at?->timestamp);
        });
    }

    /**
     * Версия URL для сброса кэшей (браузер, PWA service worker).
     *
     * Без версии заменённое фото под тем же путём неделями отдавалось
     * бы из кэша — отсюда «чужое» фото в карточке. Версия меняется
     * при каждом обновлении записи фото.
     *
     * @param string|null $url чистый URL
     * @param mixed $version метка версии (unix timestamp)
     * @return string|null URL с ?v= или исходный
     */
    private static function versionedUrl(?string $url, mixed $version): ?string
    {
        if (! $url) {
            return null;
        }

        if (! $version) {
            return $url;
        }

        $sep = str_contains($url, '?') ? '&' : '?';

        return $url.$sep.'v='.$version;
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function likes(): HasMany { return $this->hasMany(ProfilePhotoLike::class, 'photo_id'); }
    public function comments(): HasMany { return $this->hasMany(ProfilePhotoComment::class, 'photo_id'); }
}
