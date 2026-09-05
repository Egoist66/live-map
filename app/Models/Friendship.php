<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Friendship extends Model
{
    protected $fillable = ['requester_id','addressee_id','status','hidden_by_requester','hidden_by_addressee'];
    protected $casts = ['status' => 'string', 'hidden_by_requester' => 'boolean', 'hidden_by_addressee' => 'boolean'];

    public function isHiddenFor(int $userId): bool
    {
        if ($this->requester_id === $userId) return (bool) $this->hidden_by_requester;
        if ($this->addressee_id === $userId) return (bool) $this->hidden_by_addressee;
        return false;
    }

    public function setHiddenFor(int $userId, bool $hidden): void
    {
        if ($this->requester_id === $userId) $this->hidden_by_requester = $hidden;
        if ($this->addressee_id === $userId) $this->hidden_by_addressee = $hidden;
    }

    public function requester(): BelongsTo { return $this->belongsTo(User::class,'requester_id'); }
    public function addressee(): BelongsTo { return $this->belongsTo(User::class,'addressee_id'); }

    public function otherUser(int $userId): User
    {
        return $this->requester_id === $userId ? $this->addressee : $this->requester;
    }

    public static function areFriends(int $a, int $b): bool
    {
        return static::where('status','accepted')->where(function($q) use ($a,$b){
            $q->where(function($x) use ($a,$b){ $x->where('requester_id',$a)->where('addressee_id',$b); })
              ->orWhere(function($x) use ($a,$b){ $x->where('requester_id',$b)->where('addressee_id',$a); });
        })->exists();
    }

    public static function pendingBetween(int $a, int $b): ?self
    {
        return static::where('status','pending')->where(function($q) use ($a,$b){
            $q->where(function($x) use ($a,$b){ $x->where('requester_id',$a)->where('addressee_id',$b); })
              ->orWhere(function($x) use ($a,$b){ $x->where('requester_id',$b)->where('addressee_id',$a); });
        })->first();
    }
}
