<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Бизнес-профиль компании для кабинета (РБ-законодательство).
 *
 * Один владелец (user) — один активный профиль. Верификация по УНП:
 * draft → pending → verified | rejected. Только verified получает
 * бейдж «Проверено», бессрочные пины и доступ к промо-инструментам.
 *
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string|null $category
 * @property string $legal_form ooo|ip|odo|zao|self_employed|craft|other
 * @property string|null $unp УНП, 9 цифр
 * @property string|null $reg_number Номер госрегистрации
 * @property string|null $address Фактический адрес / точка на карте
 * @property string|null $legal_address Юридический адрес
 * @property string|null $director_name Руководитель / ИП
 * @property float|null $lat
 * @property float|null $lng
 * @property string|null $description
 * @property string|null $phone
 * @property string|null $website
 * @property array|null $working_hours
 * @property string $subscription_plan
 * @property bool $is_active
 * @property string $verification_status draft|pending|verified|rejected
 * @property string|null $verification_notes
 * @property \Carbon\Carbon|null $verified_at
 * @property string|null $logo_path
 * @property string|null $cover_path
 * @property-read string|null $logo_url
 * @property-read string|null $cover_url
 */
class Business extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'category',
        'legal_form',
        'unp',
        'reg_number',
        'address',
        'legal_address',
        'director_name',
        'lat',
        'lng',
        'description',
        'services',
        'phone',
        'website',
        'working_hours',
        'subscription_plan',
        'is_active',
        'verification_status',
        'verification_notes',
        'verified_at',
        'logo_path',
        'cover_path',
    ];

    protected $casts = [
        'lat' => 'decimal:7',
        'lng' => 'decimal:7',
        'working_hours' => 'array',
        'is_active' => 'boolean',
        'verified_at' => 'datetime',
    ];

    protected $appends = ['logo_url', 'cover_url'];

    public const LEGAL_FORMS = ['ooo', 'ip', 'odo', 'zao', 'self_employed', 'craft', 'other'];

    public const VERIFICATION_STATUSES = ['draft', 'pending', 'verified', 'rejected'];

    /**
     * Формы собственности, которые считаются организацией (ООО, ИП и др. юрлица).
     */
    public const ORG_LEGAL_FORMS = ['ooo', 'ip', 'odo', 'zao'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function photos(): HasMany
    {
        return $this->hasMany(BusinessPhoto::class)->orderBy('sort_order')->orderBy('id');
    }

    /**
     * @param \Illuminate\Database\Eloquent\Builder $query
     */
    public function scopeVerified($query)
    {
        return $query->where('verification_status', 'verified');
    }

    /**
     * @param \Illuminate\Database\Eloquent\Builder $query
     */
    public function scopePending($query)
    {
        return $query->where('verification_status', 'pending');
    }

    /**
     * @param \Illuminate\Database\Eloquent\Builder $query
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function isVerified(): bool
    {
        return $this->verification_status === 'verified';
    }

    public function isPending(): bool
    {
        return $this->verification_status === 'pending';
    }

    /**
     * Организация ли это (ООО / ИП / ОДО / ЗАО).
     *
     * @return bool true для юрлиц и ИП
     */
    public function isOrganization(): bool
    {
        return in_array($this->legal_form, self::ORG_LEGAL_FORMS, true);
    }

    public function getLogoUrlAttribute(): ?string
    {
        return \App\Services\MediaDisk::url($this->logo_path);
    }

    public function getCoverUrlAttribute(): ?string
    {
        return \App\Services\MediaDisk::url($this->cover_path);
    }

    /**
     * Публичное представление для карты и витрины.
     *
     * @return array<string, mixed>
     */
    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'name' => $this->name,
            'category' => $this->category,
            'legal_form' => $this->legal_form,
            'is_organization' => $this->isOrganization(),
            'address' => $this->address,
            'lat' => $this->lat !== null ? (float) $this->lat : null,
            'lng' => $this->lng !== null ? (float) $this->lng : null,
            'description' => $this->description,
            'services' => $this->services,
            'phone' => $this->phone,
            'website' => $this->website,
            'working_hours' => $this->working_hours,
            'is_verified' => $this->isVerified(),
            'verification_status' => $this->verification_status,
            'logo_url' => $this->logo_url,
            'cover_url' => $this->cover_url,
        ];
    }

    /**
     * Полное представление для кабинета владельца.
     *
     * @return array<string, mixed>
     */
    public function toCabinetArray(): array
    {
        $public = $this->toPublicArray();
        $public['owner_profile'] = $this->user?->profileIdentifier();
        $public['owner_id'] = $this->user_id;
        $public['owner_name'] = $this->user?->name;
        $public['owner_email'] = $this->user?->email;
        $public['unp'] = $this->unp;
        $public['reg_number'] = $this->reg_number;
        $public['legal_address'] = $this->legal_address;
        $public['director_name'] = $this->director_name;
        $public['verification_status'] = $this->verification_status;
        $public['verification_notes'] = $this->verification_notes;
        $public['verified_at'] = $this->verified_at?->toISOString();
        $public['is_active'] = (bool) $this->is_active;
        $public['subscription_plan'] = $this->subscription_plan;

        return $public;
    }
}
