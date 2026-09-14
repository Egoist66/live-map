<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conversation extends Model
{
    protected $fillable = ['type','created_by','pin_id','district_id','last_message_at'];
    protected $casts = ['last_message_at' => 'datetime'];

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
