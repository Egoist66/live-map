<?php

namespace App\Models;

use App\Services\MediaDisk;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Картинка треда Pipe (до 3 на тред).
 *
 * Файл лежит на media-диске (s3/public) в каталоге pipe-threads,
 * оптимизирован ImageOptimizer'ом на загрузке; thumb — рядом
 * в pipe-threads/thumbs. Публичные URL отдаются акцессорами.
 *
 * @property int $id
 * @property int $thread_id Тред-владелец
 * @property string $path Путь оригинала (оптимизированного)
 * @property string|null $thumb_path Путь миниатюры
 * @property int $sort_order Порядок в карточке
 * @property-read string|null $url Публичный URL оригинала
 * @property-read string|null $thumb_url Публичный URL миниатюры
 */
class PipeThreadMedia extends Model
{
    protected $table = 'pipe_thread_media';

    /** @var array<int,string> массово заполняемые поля */
    protected $fillable = ['thread_id', 'path', 'thumb_path', 'sort_order'];

    /** @var array<int,string> вычисляемые атрибуты сериализации */
    protected $appends = ['url', 'thumb_url'];

    /** Тред-владелец (каскадное удаление на уровне FK). */
    public function thread(): BelongsTo
    {
        return $this->belongsTo(PipeThread::class, 'thread_id');
    }

    /** Публичный URL оптимизированного оригинала. */
    protected function url(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicUrl($this->path));
    }

    /** Публичный URL миниатюры (или null, если thumb не строился). */
    protected function thumbUrl(): Attribute
    {
        return Attribute::get(fn (): ?string => $this->publicUrl($this->thumb_path));
    }

    /**
     * URL файла на media-диске.
     *
     * @param string|null $path относительный путь
     */
    private function publicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        return Storage::disk(MediaDisk::disk())->url($path);
    }
}
