<?php

namespace App\Models;

use App\Services\SavedNoteCrypto;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Личная заметка «Избранного» — чат только для себя.
 *
 * Тело в БД — сжатый gzip + AES-256-GCM шифротекст (колонка payload),
 * в коде — открытый текст через plainBody()/setPlainBody(). Вид kind
 * (text|link) хранится открытым для фильтра без расшифровки.
 *
 * @property int $id
 * @property int $user_id
 * @property string $payload шифротекст тела
 * @property string $kind text|link
 * @property string|null $attachment_path
 * @property string|null $attachment_name
 * @property string|null $attachment_mime
 * @property int|null $attachment_size
 * @property string|null $attachment_kind image|file
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
class SavedNote extends Model
{
    protected $fillable = ['user_id', 'payload', 'kind', 'attachment_path', 'attachment_name', 'attachment_mime', 'attachment_size', 'attachment_kind'];

    /**
     * Владелец заметки.
     *
     * @return BelongsTo
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Расшифрованное тело заметки.
     *
     * @return string открытый текст
     */
    public function plainBody(): string
    {
        return SavedNoteCrypto::decrypt($this->payload);
    }

    /**
     * Записать тело: определить kind и зашифровать со сжатием.
     *
     * @param string $body открытый текст
     * @return void
     */
    public function setPlainBody(string $body): void
    {
        $this->payload = SavedNoteCrypto::encrypt($body);
        $this->kind = str_contains($body, 'http://') || str_contains($body, 'https://') ? 'link' : 'text';
    }

    /**
     * Пейлоад вложения для фронта и Telegram-бота.
     *
     * @return array{url:string, name:string|null, mime:string|null, size:int|null, kind:string}|null
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
            'kind' => (string) ($this->attachment_kind ?? 'file'),
        ];
    }

    /**
     * Пейлоад для фронта и Telegram-бота.
     *
     * @return array{id:int, body:string, kind:string, attachment:array<string, mixed>|null, created_at:string|null, updated_at:string|null}
     */
    public function toPayload(): array
    {
        return [
            'id' => (int) $this->id,
            'body' => $this->plainBody(),
            'kind' => (string) ($this->kind ?? 'text'),
            'attachment' => $this->attachmentPayload(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
