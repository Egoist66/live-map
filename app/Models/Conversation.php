<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

/**
 * Диалог: direct, district, sos.
 *
 * Общий фон беседы (wallpaper_*) видит каждый участник — смена
 * одним собеседником применяется у всех через broadcast.
 *
 * @property int $id
 * @property string $type
 * @property int|null $created_by
 * @property int|null $pin_id
 * @property int|null $district_id
 * @property string|null $wallpaper_type none|preset|color|image
 * @property string|null $wallpaper_preset id встроенного градиента
 * @property string|null $wallpaper_color hex-цвет (#rrggbb)
 * @property string|null $wallpaper_image_path путь картинки в сторедже
 * @property \Carbon\Carbon|null $wallpaper_updated_at
 * @property \Carbon\Carbon|null $last_message_at
 */
class Conversation extends Model
{
    protected $fillable = ['type','created_by','pin_id','district_id','last_message_at','wallpaper_type','wallpaper_preset','wallpaper_color','wallpaper_image_path','wallpaper_updated_at'];
    protected $casts = ['last_message_at' => 'datetime', 'wallpaper_updated_at' => 'datetime'];

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class,'conversation_participants')->withPivot('last_read_at','joined_at');
    }
    public function participantRows(): HasMany { return $this->hasMany(ConversationParticipant::class); }
    public function messages(): HasMany { return $this->hasMany(Message::class)->orderBy('created_at'); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class,'created_by'); }
    public function district(): BelongsTo { return $this->belongsTo(District::class); }

    public function otherParticipant(int $userId): ?User
    {
        return $this->participants->firstWhere('id','!=',$userId);
    }

    /**
     * Общий фон беседы для фронта и broadcast.
     *
     * @return array{type:string,preset:string|null,color:string|null,image_url:string|null,updated_at:string|null}
     */
    public function wallpaperPayload(): array
    {
        $type = (string) ($this->wallpaper_type ?? 'none');
        if (! in_array($type, ['preset', 'color', 'image'], true)) {
            $type = 'none';
        }
        $imageUrl = null;
        if ($type === 'image' && $this->wallpaper_image_path) {
            try {
                $disk = config('filesystems.default') === 's3' && (bool) config('filesystems.disks.s3.bucket')
                    ? 's3'
                    : 'public';
                $imageUrl = (string) Storage::disk($disk)->url($this->wallpaper_image_path);
                if ($disk === 'public') {
                    $parts = parse_url($imageUrl);
                    if (! empty($parts['path'])) {
                        $query = isset($parts['query']) ? '?'.$parts['query'] : '';
                        $imageUrl = $parts['path'].$query;
                    }
                }
            } catch (\Throwable) {
                $imageUrl = null;
            }
            if (! $imageUrl) {
                $type = 'none';
            }
        }
        return [
            'type' => $type,
            'preset' => $type === 'preset' ? (string) ($this->wallpaper_preset ?? '') : null,
            'color' => $type === 'color' ? (string) ($this->wallpaper_color ?? '') : null,
            'image_url' => $imageUrl,
            'updated_at' => $this->wallpaper_updated_at?->toISOString(),
        ];
    }

    /**
     * Чистое членство в диалоге без учёта hidden_at.
     * Видимость в списке (hidden_at) проверяется отдельно в index,
     * иначе после "Удалить чат" show/index сокет-авторизация дают 403
     * и диалог выглядит пустым, а realtime отваливается.
     */
    public function hasParticipant(int $userId): bool
    {
        return $this->participantRows()->where('user_id',$userId)->exists();
    }

    public static function findDirect(int $a, int $b): ?self
    {
        return static::where('type','direct')
            ->whereHas('participantRows', fn($q)=>$q->where('user_id',$a))
            ->whereHas('participantRows', fn($q)=>$q->where('user_id',$b))
            ->whereHas('participantRows', fn($q)=>$q, '=', 2)
            ->first();
    }
}
