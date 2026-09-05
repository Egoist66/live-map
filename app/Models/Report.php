<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $fillable = ['reporter_id', 'target_type', 'target_id', 'reason', 'description', 'status', 'moderator_id', 'resolved_at'];
    protected $casts = ['resolved_at' => 'datetime'];
    public function reporter(): BelongsTo { return $this->belongsTo(User::class, 'reporter_id'); }
    public function moderator(): BelongsTo { return $this->belongsTo(User::class, 'moderator_id'); }

    public static function reasons(): array
    {
        return [
            'spam' => 'Спам',
            'abuse' => 'Оскорбления',
            'inappropriate' => 'Неприемлемый контент',
            'illegal' => 'Нарушение закона',
            'fake' => 'Фейк / недостоверно',
        ];
    }

    public function targetTitle(): ?string
    {
        try {
            if ($this->target_type === 'pin') {
                return Pin::where('id', $this->target_id)->value('title');
            }
            if ($this->target_type === 'comment') {
                $c = PinComment::where('id', $this->target_id)->value('content');
                return $c ? mb_strimwidth(trim(preg_replace('/\s+/', ' ', $c) ?? ''), 0, 80, '…') : null;
            }
            if ($this->target_type === 'user') {
                return User::where('id', $this->target_id)->value('name');
            }
        } catch (\Throwable) {
        }
        return null;
    }

    public function toNotifyArray(): array
    {
        $reporter = $this->relationLoaded('reporter') ? $this->reporter : $this->reporter()->first(['id', 'name', 'avatar_path']);
        return [
            'id' => $this->id,
            'target_type' => $this->target_type,
            'target_id' => $this->target_id,
            'target_title' => $this->targetTitle(),
            'reason' => $this->reason,
            'reason_label' => static::reasons()[$this->reason] ?? $this->reason,
            'description' => $this->description,
            'status' => $this->status,
            'created_at' => $this->created_at,
            'reporter' => $reporter ? array_merge($reporter->only(['id', 'name']), ['avatar_url' => $reporter->avatar_url]) : ['id' => $this->reporter_id],
        ];
    }
}
