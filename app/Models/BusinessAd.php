<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Реклама проверенного бизнеса: новость или акция компании.
 *
 * Публикует только владелец верифицированного бизнеса (isVerified),
 * видят все на публичной витрине Business/Show. Анти-спам: максимум
 * BusinessAdController::WEEKLY_LIMIT штук за скользящие 7 дней.
 *
 * @property int $id
 * @property int $business_id
 * @property int $user_id
 * @property string $title заголовок (до 100 символов)
 * @property string $body текст (до 1000 символов)
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 */
class BusinessAd extends Model
{
    protected $fillable = [
        'business_id',
        'user_id',
        'title',
        'body',
    ];

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Сколько рекламы бизнес выпустил за скользящие 7 дней.
     *
     * @param int $businessId бизнес
     * @return int использовано слотов
     */
    public static function usedThisWeek(int $businessId): int
    {
        return static::where('business_id', $businessId)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();
    }

    /**
     * Публичное представление для витрины и кабинета.
     *
     * @return array<string, mixed>
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'business_id' => $this->business_id,
            'title' => $this->title,
            'body' => $this->body,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
