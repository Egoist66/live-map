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

    /** Макс вес голосового сообщения: 5 МБ (минута opus занимает < 1 МБ). */
    public const VOICE_MAX_BYTES = 5 * 1024 * 1024;

    /** Макс длительность голосового сообщения в секундах. */
    public const VOICE_MAX_SECONDS = 60;

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
     * Голосовые сообщения: расширение => допустимые mime.
     *
     * Запись идёт через MediaRecorder: Chrome/Android даёт audio/webm
     * с opus, Safari/iOS — audio/mp4 (m4a), Firefox — audio/ogg.
     * Mime сравнивается без параметров после «;» (codecs=opus и т.п.).
     */
    public const VOICE = [
        'webm' => ['audio/webm', 'video/webm'],
        'ogg' => ['audio/ogg', 'video/ogg'],
        'oga' => ['audio/ogg'],
        'opus' => ['audio/ogg', 'audio/opus'],
        'm4a' => ['audio/mp4', 'audio/x-m4a', 'audio/m4a'],
        'mp4' => ['audio/mp4'],
        'mp3' => ['audio/mpeg', 'audio/mp3'],
        'wav' => ['audio/wav', 'audio/x-wav', 'audio/wave'],
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
     * @return string kind: image|file|voice
     * @throws ValidationException
     */
    public static function validate(UploadedFile $file): string
    {
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

        if (isset(self::VOICE[$ext])) {
            return self::validateVoice($file, $ext);
        }

        $size = $file->getSize() ?: 0;
        if ($size > self::MAX_BYTES) {
            throw ValidationException::withMessages([
                'attachment' => 'Файл больше 10 МБ',
            ]);
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
     * Проверяет голосовое сообщение: вес и соответствие mime расширению.
     *
     * Длительность (макс 60 c) режется на клиенте рекордером — сюда
     * минутный opus в любом случае проходит по весу с запасом.
     *
     * @param UploadedFile $file загруженный аудиофайл
     * @param string $ext расширение файла
     * @return string всегда 'voice'
     * @throws ValidationException
     */
    public static function validateVoice(UploadedFile $file, string $ext): string
    {
        $size = $file->getSize() ?: 0;
        if ($size > self::VOICE_MAX_BYTES) {
            throw ValidationException::withMessages([
                'attachment' => 'Голосовое сообщение больше 5 МБ',
            ]);
        }

        $raw = strtolower((string) $file->getMimeType());
        $mime = explode(';', $raw)[0];
        $mime = trim($mime);
        if (! in_array($mime, self::VOICE[$ext], true)) {
            throw ValidationException::withMessages([
                'attachment' => 'Файл не похож на голосовое сообщение',
            ]);
        }

        return 'voice';
    }

    /**
     * Сохраняет вложение в chat-attachments.
     *
     * Фото жмёт через ImageOptimizer, документы и голосовые кладёт как есть.
     *
     * @param UploadedFile $file проверенный файл
     * @param string $kind image|file|voice
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
