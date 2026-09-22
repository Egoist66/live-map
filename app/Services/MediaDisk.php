<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;

/**
 * Где лежат загружаемые медиа и как строить их URL.
 *
 * На проде (Laravel Cloud) локальный диск эфемерен — файлы пропадают
 * и отдают 404, поэтому при настроенном S3 всё едет туда же, куда
 * и фото профиля. Единая точка вместо копипасты тернарника.
 */
final class MediaDisk
{
    /**
     * @return string s3 когда настроен, иначе public
     */
    public static function disk(): string
    {
        $isS3 = config('filesystems.default') === 's3' && config('filesystems.disks.s3.bucket');

        return $isS3 ? 's3' : 'public';
    }

    /**
     * Публичный URL файла на правильном диске.
     *
     * @param string|null $path путь в сторедже
     * @return string|null URL или null без пути/при ошибке
     */
    public static function url(?string $path): ?string
    {
        if (empty($path)) {
            return null;
        }

        try {
            $url = Storage::disk(static::disk())->url($path);
        } catch (\Throwable) {
            return null;
        }

        if (static::disk() === 'public') {
            $parts = parse_url($url);

            if (! empty($parts['path'])) {
                return $parts['path'] . (isset($parts['query']) ? '?' . $parts['query'] : '');
            }
        }

        return $url;
    }

    /**
     * Удалить файл с правильного диска (best-effort).
     *
     * @param string|null $path путь в сторедже
     * @return void
     */
    public static function delete(?string $path): void
    {
        if (empty($path)) {
            return;
        }

        try {
            Storage::disk(static::disk())->delete($path);
        } catch (\Throwable) {
        }
    }
}
