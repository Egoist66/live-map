<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Сообщение чата: текст, вложения и голосовые.
 *
 * Голосовое — это вложение с kind=voice и длительностью
 * в attachment_duration (секунды, макс 60).
 *
 * @property int $id
 * @property int $conversation_id
 * @property int|null $reply_to_id
 * @property int $sender_id
 * @property string $body
 * @property string $type
 * @property string|null $attachment_path
 * @property string|null $attachment_name
 * @property string|null $attachment_mime
 * @property int|null $attachment_size
 * @property string|null $attachment_kind
 * @property int|null $attachment_duration
 */
class Message extends Model
{
    protected $fillable = ['conversation_id','reply_to_id','sender_id','body','type','read_at','delivered_at','edited_at','pinned_at','pinned_by','attachment_path','attachment_name','attachment_mime','attachment_size','attachment_kind','attachment_duration'];
    protected $casts = [
        'body' => \App\Casts\MessageBodyCast::class,
        'read_at' => 'datetime',
        'delivered_at' => 'datetime',
        'edited_at' => 'datetime',
        'pinned_at' => 'datetime',
    ];

    public function conversation(): BelongsTo { return $this->belongsTo(Conversation::class); }
    public function sender(): BelongsTo { return $this->belongsTo(User::class,'sender_id'); }

    /**
     * Сообщение, на которое дан ответ.
     */
    public function replyTo(): BelongsTo { return $this->belongsTo(Message::class,'reply_to_id'); }

    public function statusFor(?int $viewerId = null): string
    {
        if ($this->read_at) return 'read';
        if ($this->delivered_at) return 'delivered';
        return 'sent';
    }

    /**
     * Короткое представление цитируемого сообщения для ответа.
     *
     * У голосового без текста подставляется подпись с длительностью,
     * чтобы цитата не была пустой.
     */
    public function replyToPayload(): ?array
    {
        $orig = $this->relationLoaded('replyTo') ? $this->replyTo : $this->replyTo()->first();
        if (! $orig) return null;
        $sender = $orig->relationLoaded('sender') ? $orig->sender : $orig->sender()->first(['id', 'name']);
        $body = (string) $orig->body;
        if ($body === '' && $orig->attachment_kind === 'voice') {
            $body = '🎤 Голосовое сообщение';
            if ($orig->attachment_duration) {
                $body .= ' ('.$orig->attachment_duration.' c)';
            }
        }
        return [
            'id' => $orig->id,
            'body' => $body,
            'sender_id' => $orig->sender_id,
            'sender_name' => $sender?->name,
        ];
    }

    /**
     * Пейлоад вложения для фронта: url, имя, mime, размер, вид, длительность.
     *
     * @return array|null
     */
    public function attachmentPayload(): ?array
    {
        if (! $this->attachment_path) {
            return null;
        }

        return [
            'url' => \App\Services\ChatAttachment::url($this->attachment_path),
            'name' => $this->attachment_name,
            'mime' => $this->attachment_mime,
            'size' => $this->attachment_size !== null ? (int) $this->attachment_size : null,
            'kind' => $this->attachment_kind,
            'duration' => $this->attachment_duration !== null ? (int) $this->attachment_duration : null,
        ];
    }

    public function toArrayPayload(): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'reply_to_id' => $this->reply_to_id,
            'reply_to' => $this->reply_to_id ? $this->replyToPayload() : null,
            'sender_id' => $this->sender_id,
            'body' => $this->body,
            'type' => $this->type,
            'attachment' => $this->attachmentPayload(),
            'created_at' => $this->created_at?->toISOString(),
            'edited_at' => $this->edited_at?->toISOString(),
            'delivered_at' => $this->delivered_at?->toISOString(),
            'read_at' => $this->read_at?->toISOString(),
            'status' => $this->statusFor(),
            'is_edited' => $this->edited_at !== null,
            'is_pinned' => $this->pinned_at !== null,
            'pinned_at' => $this->pinned_at?->toISOString(),
            'pinned_by' => $this->pinned_by,
            'sender' => $this->relationLoaded('sender') ? [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'avatar_path' => $this->sender->avatar_path,
                'avatar_url' => $this->sender->avatar_url,
            ] : null,
        ];
    }
}
