<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Новость UDistrict: пост владельца района для жителей.
 *
 * Создаёт только владелец (или админ), читают жители и гости,
 * комментируют и лайкают жители. Жители получают уведомления
 * о новом посте, пине внутри района и ответах в ветках.
 *
 * @property int $id
 * @property int $district_id
 * @property int|null $business_ad_id копия рекламы компании (null — обычная новость)
 * @property int $user_id автор (владелец района)
 * @property string|null $title заголовок
 * @property string $body текст новости
 * @property string|null $image_path картинка новости
 * @property string|null $image_url публичный URL картинки
 * @property int $likes_count
 * @property int $comments_count
 */
class DistrictPost extends Model
{
    protected $fillable = [
        'district_id',
        'business_ad_id',
        'user_id',
        'title',
        'body',
        'image_path',
    ];

    protected $appends = ['image_url'];

    public function district(): BelongsTo
    {
        return $this->belongsTo(District::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Реклама компании, копией которой является пост (null — обычная новость).
     */
    public function businessAd(): BelongsTo
    {
        return $this->belongsTo(BusinessAd::class);
    }

    /**
     * Реклама компании ли это (а не новость владельца района).
     *
     * @return bool true когда пост — копия business_ads
     */
    public function isCompanyAd(): bool
    {
        return $this->business_ad_id !== null;
    }

    public function comments(): HasMany
    {
        return $this->hasMany(DistrictPostComment::class, 'post_id');
    }

    public function likes(): HasMany
    {
        return $this->hasMany(DistrictPostLike::class, 'post_id');
    }

    /**
     * Публичный URL картинки новости или null.
     *
     * @return Attribute<string|null, never>
     */
    protected function imageUrl(): Attribute
    {
        return Attribute::get(function (): ?string {
            if (! $this->image_path) {
                return null;
            }

            return Storage::disk(District::coverDisk())->url($this->image_path);
        });
    }
}
