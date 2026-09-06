<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Storage;

class ProfilePhoto extends Model
{
    protected $fillable = ['user_id', 'path', 'caption'];

    protected $appends = ['url'];

    protected function url(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (!$this->path) return null;
            $disk = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket') ? 's3' : 'public';
            $url = Storage::disk($disk)->url($this->path);
            if ($disk === 'public') {
                $parts = parse_url($url);
                if (!empty($parts['path'])) {
                    return $parts['path'] . (isset($parts['query']) ? '?' . $parts['query'] : '');
                }
            }
            return $url;
        });
    }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function likes(): HasMany { return $this->hasMany(ProfilePhotoLike::class, 'photo_id'); }
    public function comments(): HasMany { return $this->hasMany(ProfilePhotoComment::class, 'photo_id'); }
}
