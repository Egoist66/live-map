<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Вложения сообщений чата: фото и документы.
 *
 * Разрешены только безопасные типы: картинки и офисные документы.
 * Скрипты и исполняемые файлы запрещены по расширению и mime.
 */
class ChatAttachment
{
    /** Макс вес вложения: 10 МБ. */
    public const MAX_BYTES = 10 * 1024 * 1024;

    /** Срок хранения вложений в днях: дальше удаляются автоматически. */
    public const RETENTION_DAYS = 15;

    /** Разрешённые расширения по mime. */
    public const ALLOWED = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        'pdf' => 'application/pdf',
        'doc' => 'application/msword',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls' => 'application/vnd.ms-excel',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt' => 'text/plain',
        'zip' => 'application/zip',
    ];

    /** Запрещённые расширения: скрипты и исполняемые файлы. */
    public const FORBIDDEN = [
        'php', 'phtml', 'phar', 'exe', 'msi', 'bat', 'cmd', 'com', 'scr',
        'sh', 'bash', 'zsh', 'js', 'mjs', 'html', 'htm', 'svg', 'jar',
        'ps1', 'vbs', 'dll', 'so', 'dylib', 'apk', 'deb', 'rpm',
    ];

    /**
     * Диск для вложений: s3 при настройке, иначе public.
     *
     * @return string
     */
    public static function disk(): string
    {
        $isS3 = config('filesystems.default') === 's3';
        $hasBucket = (bool) config('filesystems.disks.s3.bucket');

        return $isS3 && $hasBucket ? 's3' : 'public';
    }

    /**
     * Проверяет файл по размеру, расширению и mime.
     *
     * @param UploadedFile $file загруженный файл
     * @return string kind: image|file
     * @throws ValidationException
     */
    public static function validate(UploadedFile $file): string
    {
        $size = $file->getSize() ?: 0;
        if ($size > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                'attachment' => 'Файл больше 10 МБ',
            ]);
        }

        $original = (string) $file->getClientOriginalName();
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        $parts = array_map('strtolower', explode('.', $original));
        foreach ($parts as $part) {
            if (in_array($part, self::FORBIDDEN, true)) {
                throw ValidationException::withMessages([
                    'attachment' => 'Такой тип файла запрещён',
                ]);
            }
        }

        if (! isset(self::ALLOWED[$ext])) {
            throw ValidationException::withMessages([
                'attachment' => 'Разрешены фото (jpg, png, webp, gif) и документы (pdf, doc, docx, xls, xlsx, txt, zip)',
            ]);
        }

        $mime = (string) $file->getMimeType();
        $expected = self::ALLOWED[$ext];
        $isZipAlias = $ext === 'zip' && in_array($mime, ['application/x-zip-compressed', 'application/x-zip'], true);
        if ($mime !== $expected && ! $isZipAlias) {
            throw ValidationException::withMessages([
                'attachment' => 'Файл не совпадает с заявленным типом',
            ]);
        }

        return str_starts_with($expected, 'image/') ? 'image' : 'file';
    }

    /**
     * Сохраняет вложение в chat-attachments.
     *
     * Фото жмёт через ImageOptimizer, документы кладёт как есть.
     *
     * @param UploadedFile $file проверенный файл
     * @param string $kind image|file
     * @return array{path: string, name: string, mime: string, size: int, kind: string}
     */
    public static function store(UploadedFile $file, string $kind): array
    {
        $disk = self::disk();
        if ($kind === 'image') {
            $path = ImageOptimizer::storeOptimized($file, 'chat-attachments', $disk);
        } else {
            $path = $file->store('chat-attachments', $disk);
        }
        try {
            $storedSize = (int) Storage::disk($disk)->size($path);
        } catch (\Throwable) {
            $storedSize = (int) ($file->getSize() ?: 0);
        }
        if ($storedSize <= 0) {
            $storedSize = (int) ($file->getSize() ?: 0);
        }

        return [
            'path' => $path,
            'name' => $file->getClientOriginalName(),
            'mime' => (string) $file->getMimeType(),
            'size' => $storedSize,
            'kind' => $kind,
        ];
    }

    /**
     * Удаляет вложение с диска.
     *
     * @param string|null $path путь файла
     * @return void
     */
    public static function delete(?string $path): void
    {
        if (! $path) {
            return;
        }
        try {
            Storage::disk(self::disk())->delete($path);
        } catch (\Throwable) {
        }
    }

    /**
     * Публичный URL вложения.
     *
     * @param string|null $path путь файла
     * @return string|null
     */
    public static function url(?string $path): ?string
    {
        if (! $path) {
            return null;
        }
        try {
            $url = Storage::disk(self::disk())->url($path);
        } catch (\Throwable) {
            return null;
        }
        if (self::disk() === 'public') {
            $parts = parse_url($url);
            if (! empty($parts['path'])) {
                $query = isset($parts['query']) ? '?' . $parts['query'] : '';

                return $parts['path'] . $query;
            }
        }

        return $url;
    }
}
