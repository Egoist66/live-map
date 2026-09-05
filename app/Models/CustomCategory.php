<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomCategory extends Model
{
    protected $fillable = ['user_id', 'slug', 'label', 'icon', 'color'];

    public function getRouteKeyName(): string { return 'slug'; }

    public function user(): BelongsTo { return $this->belongsTo(User::class); }

    public function toPublicArray(): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'label' => $this->label,
            'icon' => $this->icon,
            'color' => $this->color,
            'is_owner' => auth()->id() === $this->user_id,
        ];
    }
}
