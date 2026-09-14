<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * UDistrict — свой район: залитый кистью островок внутри домашней зоны.
 *
 * Район видят все, а пины внутри — только участники.
 * Доступ — по заявкам, которые одобряет владелец (как группы в соцсетях).
 * Геометрия — GeoJSON MultiPolygon из мазков кисти (Alt+Enter или кнопка).
 *
 * @property int $id
 * @property int $user_id владелец района
 * @property string $name название
 * @property string|null $description чем тут занимаются
 * @property string $interest интерес островка
 * @property array $geometry GeoJSON MultiPolygon
 * @property float $center_lat центроид для bbox-индекса
 * @property float $center_lng центроид для bbox-индекса
 * @property int|null $conversation_id общий чат района
 */
class District extends Model
{
    /**
     * Интересы островков для выбора при создании.
     */
    public const INTERESTS = [
        'neighbors',
        'sport',
        'music',
        'pets',
        'kids',
        'food',
        'study',
        'games',
        'art',
        'help',
    ];

    protected $fillable = [
        'user_id',
        'name',
        'description',
        'interest',
        'geometry',
        'center_lat',
        'center_lng',
        'conversation_id',
    ];

    protected $casts = [
        'geometry' => 'array',
        'center_lat' => 'decimal:7',
        'center_lng' => 'decimal:7',
    ];

    public function owner(): BelongsTo { return $this->belongsTo(User::class, 'user_id'); }

    public function members(): HasMany { return $this->hasMany(DistrictMember::class); }

    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }

    /**
     * Одобренные участники (без владельца — он входит по праву).
     */
    public function approvedMembers(): HasMany
    {
        return $this->members()->where('status', DistrictMember::STATUS_APPROVED);
    }

    /**
     * Заявки на рассмотрении.
     */
    public function pendingMembers(): HasMany
    {
        return $this->members()->where('status', DistrictMember::STATUS_PENDING);
    }

    /**
     * Роль пользователя в районе.
     *
     * @param int|null $userId кто смотрит
     * @return string owner|member|pending|guest
     */
    public function roleOf(?int $userId): string
    {
        if ($userId && (int) $this->user_id === (int) $userId) {
            return 'owner';
        }
        if (!$userId) {
            return 'guest';
        }
        $status = $this->members()->where('user_id', $userId)->value('status');
        if ($status === DistrictMember::STATUS_APPROVED) {
            return 'member';
        }
        if ($status === DistrictMember::STATUS_PENDING) {
            return 'pending';
        }

        return 'guest';
    }

    /**
     * Публичная карточка для слоя карты: геометрия + счётчики, без пинов.
     *
     * @param int|null $viewerId кто смотрит
     * @return array<string,mixed>
     */
    public function toPublicArray(?int $viewerId = null): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'interest' => $this->interest,
            'geometry' => $this->geometry,
            'center_lat' => (float) $this->center_lat,
            'center_lng' => (float) $this->center_lng,
            'owner' => $this->owner ? [
                'id' => $this->owner->id,
                'name' => $this->owner->name,
                'avatar_url' => $this->owner->avatar_url,
            ] : null,
            'members_count' => (int) ($this->getAttribute('approved_members_count') ?? $this->approvedMembers()->count()) + 1,
            'role' => $this->roleOf($viewerId),
            'conversation_id' => $this->conversation_id,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
