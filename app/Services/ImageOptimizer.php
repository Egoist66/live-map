<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Оптимизация загружаемых фото: лимит 10 МБ + сжатие через GD.
 *
 * Ресайз по длинной стороне и пересохранение с умеренным качеством:
 * диск экономится в разы, визуальная потеря минимальна.
 * Без GD или для анимированных GIF/SVG просто сохраняет оригинал.
 */
class ImageOptimizer
{
    /** Жёсткий лимит входящего файла: 10 МБ. */
    public const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

    /** Длинная сторона по умолчанию: хватает для retina без перевеса. */
    public const DEFAULT_MAX_SIDE = 1920;

    /** Длинная сторона аватара: больше не нужно. */
    public const AVATAR_MAX_SIDE = 800;

    /** Качество JPEG/WebP: 82 — баланс веса и картинки. */
    public const DEFAULT_QUALITY = 82;

    /** Ниже этого веса и размера не пережимаем, чтобы не терять качество. */
    private const SKIP_BELOW_BYTES = 400 * 1024;

    /**
     * Сохраняет фото на диск с оптимизацией.
     *
     * @param  UploadedFile  $file  входящий файл
     * @param  string  $directory  папка на диске
     * @param  string  $disk  диск Laravel
     * @param  array{maxSide?:int,quality?:int}  $options  ресайз и качество
     * @return string путь сохранённого файла
     */
    public static function storeOptimized(UploadedFile $file, string $directory, string $disk, array $options = []): string
    {
        $maxSide = (int) ($options['maxSide'] ?? self::DEFAULT_MAX_SIDE);
        $quality = (int) ($options['quality'] ?? self::DEFAULT_QUALITY);

        $optimizedPath = self::tryOptimize($file, $maxSide, $quality);

        if ($optimizedPath === null) {
            return $file->store($directory, $disk);
        }

        $extension = strtolower(pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));
        $extension = $extension !== '' ? $extension : 'jpg';

        $fileName = uniqid('', true).'.'.$extension;
        $targetPath = trim($directory, '/').'/'.$fileName;

        $stored = Storage::disk($disk)->put($targetPath, file_get_contents($optimizedPath));

        @unlink($optimizedPath);

        if ($stored) {
            return $targetPath;
        }

        return $file->store($directory, $disk);
    }

    /**
     * Пытается сжать картинку во временный файл.
     *
     * @param  UploadedFile  $file  исходник
     * @param  int  $maxSide  потолок длинной стороны
     * @param  int  $quality  качество 1-100
     * @return string|null путь tmp-файла или null если оптимизация невозможна
     */
    private static function tryOptimize(UploadedFile $file, int $maxSide, int $quality): ?string
    {
        if (! self::canProcess($file)) {
            return null;
        }

        $tmpSource = $file->getRealPath();

        if (! is_string($tmpSource) || ! is_file($tmpSource)) {
            return null;
        }

        $info = @getimagesize($tmpSource);

        if ($info === false) {
            return null;
        }

        $width = (int) $info[0];
        $height = (int) $info[1];
        $mime = (string) ($info['mime'] ?? '');

        if ($width <= 0 || $height <= 0) {
            return null;
        }

        $isSmallFile = ($file->getSize() ?: 0) < self::SKIP_BELOW_BYTES;
        $isSmallImage = max($width, $height) <= $maxSide;

        if ($isSmallFile && $isSmallImage) {
            return null;
        }

        $source = self::createSource($tmpSource, $mime);

        if ($source === null) {
            return null;
        }

        $source = self::applyExifOrientation($source, $tmpSource);

        $scale = min(1, $maxSide / max($width, $height));
        $newWidth = max(1, (int) round($width * $scale));
        $newHeight = max(1, (int) round($height * $scale));

        $canvas = imagecreatetruecolor($newWidth, $newHeight);

        if ($canvas === false) {
            imagedestroy($source);

            return null;
        }

        self::preserveTransparency($canvas, $mime);

        $resampled = imagecopyresampled($canvas, $source, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
        imagedestroy($source);

        if (! $resampled) {
            imagedestroy($canvas);

            return null;
        }

        $tmpOut = tempnam(sys_get_temp_dir(), 'imgopt');

        if ($tmpOut === false) {
            imagedestroy($canvas);

            return null;
        }

        $saved = self::saveCanvas($canvas, $tmpOut, $mime, $quality);
        imagedestroy($canvas);

        if (! $saved) {
            @unlink($tmpOut);

            return null;
        }

        return $tmpOut;
    }

    /**
     * Проверяет, что файл можно жать через GD.
     *
     * @param  UploadedFile  $file  входящий файл
     */
    private static function canProcess(UploadedFile $file): bool
    {
        if (! function_exists('imagecreatetruecolor') || ! function_exists('getimagesize')) {
            return false;
        }

        $mime = (string) $file->getMimeType();

        if ($mime === 'image/svg+xml') {
            return false;
        }

        if ($mime === 'image/gif' && self::isAnimatedGif($file->getRealPath())) {
            return false;
        }

        return str_starts_with($mime, 'image/');
    }

    /**
     * Создаёт GD-ресурс из файла по mime.
     *
     * @param  string  $path  путь исходника
     * @param  string  $mime  mime-тип
     * @return mixed|null
     */
    private static function createSource(string $path, string $mime)
    {
        if ($mime === 'image/jpeg' && function_exists('imagecreatefromjpeg')) {
            $img = @imagecreatefromjpeg($path);

            return $img === false ? null : $img;
        }

        if ($mime === 'image/png' && function_exists('imagecreatefrompng')) {
            $img = @imagecreatefrompng($path);

            return $img === false ? null : $img;
        }

        if ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) {
            $img = @imagecreatefromwebp($path);

            return $img === false ? null : $img;
        }

        if ($mime === 'image/gif' && function_exists('imagecreatefromgif')) {
            $img = @imagecreatefromgif($path);

            return $img === false ? null : $img;
        }

        return null;
    }

    /**
     * Сохраняет canvas во временный файл с нужным качеством.
     *
     * @param  mixed  $canvas  GD-ресурс
     * @param  string  $path  куда писать
     * @param  string  $mime  исходный mime
     * @param  int  $quality  качество 1-100
     */
    private static function saveCanvas($canvas, string $path, string $mime, int $quality): bool
    {
        $quality = max(1, min(100, $quality));

        if ($mime === 'image/png' && function_exists('imagepng')) {
            $level = (int) round((100 - $quality) / 100 * 9);

            return @imagepng($canvas, $path, max(0, min(9, $level)));
        }

        if ($mime === 'image/webp' && function_exists('imagewebp')) {
            return @imagewebp($canvas, $path, $quality);
        }

        if ($mime === 'image/gif' && function_exists('imagegif')) {
            return @imagegif($canvas, $path);
        }

        if (function_exists('imagejpeg')) {
            return @imagejpeg($canvas, $path, $quality);
        }

        return false;
    }

    /**
     * Включает прозрачность для PNG/WebP/GIF.
     *
     * @param  mixed  $canvas  GD-ресурс
     * @param  string  $mime  mime-тип
     */
    private static function preserveTransparency($canvas, string $mime): void
    {
        $hasAlpha = in_array($mime, ['image/png', 'image/webp', 'image/gif'], true);

        if (! $hasAlpha) {
            return;
        }

        imagealphablending($canvas, false);
        imagesavealpha($canvas, true);

        $transparent = imagecolorallocatealpha($canvas, 0, 0, 0, 127);
        imagefilledrectangle($canvas, 0, 0, imagesx($canvas), imagesy($canvas), $transparent);
    }

    /**
     * Поворачивает картинку по EXIF, если расширение доступно.
     *
     * @param  mixed  $source  GD-ресурс
     * @param  string  $path  путь исходника
     * @return mixed
     */
    private static function applyExifOrientation($source, string $path)
    {
        if (! function_exists('exif_read_data') || ! function_exists('imagerotate')) {
            return $source;
        }

        try {
            $exif = @exif_read_data($path);
        } catch (\Throwable) {
            return $source;
        }

        $orientation = (int) ($exif['Orientation'] ?? 1);

        $rotated = match ($orientation) {
            3 => imagerotate($source, 180, 0),
            6 => imagerotate($source, -90, 0),
            8 => imagerotate($source, 90, 0),
            default => $source,
        };

        if ($rotated !== $source) {
            imagedestroy($source);
        }

        return $rotated;
    }

    /**
     * Определяет анимированный GIF по маркерам кадров.
     *
     * @param  string|false  $path  путь tmp-файла
     */
    private static function isAnimatedGif(string|false $path): bool
    {
        if (! is_string($path) || ! is_file($path)) {
            return false;
        }

        $raw = @file_get_contents($path, false, null, 0, 1024 * 1024);

        if (! is_string($raw)) {
            return false;
        }

        $frames = substr_count($raw, "\x21\xF9\x04");

        return $frames > 1;
    }
}
