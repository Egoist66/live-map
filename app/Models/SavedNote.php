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
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
class SavedNote extends Model
{
    protected $fillable = ['user_id', 'payload', 'kind'];

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
     * Пейлоад для фронта и Telegram-бота.
     *
     * @return array{id:int, body:string, kind:string, created_at:string|null, updated_at:string|null}
     */
    public function toPayload(): array
    {
        return [
            'id' => (int) $this->id,
            'body' => $this->plainBody(),
            'kind' => (string) ($this->kind ?? 'text'),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
