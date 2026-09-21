<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Один signaling-фрейм видеозвонка (offer/answer/ice/accepted/...).
 *
 * Персистентность — ключ к polling-режиму: сокет доставляет событие
 * мгновенно через broadcast, а клиент без сокета забирает те же строки
 * через /api/realtime/sync и разносит их в тот же bus user:video.signal.
 *
 * @property int $id
 * @property int $call_id
 * @property int $sender_id
 * @property string $kind
 * @property array|null $payload
 */
class VideoSignal extends Model
{
    public const KIND_OFFER = 'offer';

    public const KIND_ANSWER = 'answer';

    public const KIND_ICE = 'ice';

    public const KIND_ACCEPTED = 'accepted';

    public const KIND_DECLINED = 'declined';

    public const KIND_HANGUP = 'hangup';

    public const KIND_TIMEOUT = 'timeout';

    public const KIND_JOINED = 'joined';

    protected $fillable = [
        'call_id',
        'sender_id',
        'kind',
        'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];

    public function call(): BelongsTo
    {
        return $this->belongsTo(VideoCall::class, 'call_id');
    }
}
