<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

/**
 * Брендинг приложения из админки: иконка приложения и favicon.
 *
 * Файлы лежат на медиа-диске (S3 на проде, public локально), в
 * `app_settings` хранятся только пути и версии для сброса кэша.
 * Сервис отдаёт готовые URL для Blade, Inertia, манифеста PWA и пуша.
 */
final class BrandingService
{
    /** Ключ настройки с путём к иконке приложения. */
    public const APP_ICON_PATH_KEY = 'branding.app_icon_path';

    /** Ключ настройки с версией иконки приложения. */
    public const APP_ICON_VERSION_KEY = 'branding.app_icon_version';

    /** Ключ настройки с путём к favicon. */
    public const FAVICON_PATH_KEY = 'branding.favicon_path';

    /** Ключ настройки с версией favicon. */
    public const FAVICON_VERSION_KEY = 'branding.favicon_version';

    /** Иконка приложения по умолчанию. */
    public const DEFAULT_APP_ICON = '/pwa-192x192.png?v=2';

    /** Favicon по умолчанию. */
    public const DEFAULT_FAVICON = '/favicon.ico?v=2';

    /**
     * Полное состояние брендинга для админки и общих пропсов.
     *
     * @return array{app_icon: array{url: string, is_custom: bool}, favicon: array{url: string, is_custom: bool}, version: string}
     */
    public static function state(): array
    {
        $iconPath = self::cleanPath(AppSettings::get(self::APP_ICON_PATH_KEY));
        $faviconPath = self::cleanPath(AppSettings::get(self::FAVICON_PATH_KEY));

        $iconUrl = self::versionedUrl(
            MediaDisk::url($iconPath),
            (string) AppSettings::get(self::APP_ICON_VERSION_KEY, '2'),
        );
        $faviconUrl = self::versionedUrl(
            MediaDisk::url($faviconPath),
            (string) AppSettings::get(self::FAVICON_VERSION_KEY, '2'),
        );

        $iconVersion = (int) AppSettings::get(self::APP_ICON_VERSION_KEY, '2');
        $faviconVersion = (int) AppSettings::get(self::FAVICON_VERSION_KEY, '2');

        return [
            'app_icon' => [
                'url' => $iconUrl ?? self::DEFAULT_APP_ICON,
                'is_custom' => $iconUrl !== null,
            ],
            'favicon' => [
                'url' => $faviconUrl ?? self::DEFAULT_FAVICON,
                'is_custom' => $faviconUrl !== null,
            ],
            'version' => (string) max(2, $iconVersion, $faviconVersion),
        ];
    }

    /**
     * Значения по умолчанию на случай ошибки БД.
     *
     * @return array{app_icon: array{url: string, is_custom: bool}, favicon: array{url: string, is_custom: bool}, version: string}
     */
    public static function defaults(): array
    {
        return [
            'app_icon' => ['url' => self::DEFAULT_APP_ICON, 'is_custom' => false],
            'favicon' => ['url' => self::DEFAULT_FAVICON, 'is_custom' => false],
            'version' => '2',
        ];
    }

    /**
     * Сохранить новую иконку приложения.
     *
     * @param UploadedFile $file загруженный квадратный PNG/JPG/WebP
     * @return array<string, mixed> обновлённое состояние
     */
    public static function storeAppIcon(UploadedFile $file): array
    {
        return self::store(
            $file,
            'app-icon',
            self::APP_ICON_PATH_KEY,
            self::APP_ICON_VERSION_KEY,
        );
    }

    /**
     * Сохранить новый favicon.
     *
     * @param UploadedFile $file загруженный ICO или PNG
     * @return array<string, mixed> обновлённое состояние
     */
    public static function storeFavicon(UploadedFile $file): array
    {
        return self::store(
            $file,
            'favicon',
            self::FAVICON_PATH_KEY,
            self::FAVICON_VERSION_KEY,
        );
    }

    /**
     * Сбросить иконку приложения или favicon к дефолтной.
     *
     * @param string $kind app_icon|favicon
     * @return array<string, mixed> обновлённое состояние
     */
    public static function reset(string $kind): array
    {
        $isFavicon = $kind === 'favicon';
        $pathKey = $isFavicon ? self::FAVICON_PATH_KEY : self::APP_ICON_PATH_KEY;
        $versionKey = $isFavicon ? self::FAVICON_VERSION_KEY : self::APP_ICON_VERSION_KEY;
        $oldPath = self::cleanPath(AppSettings::get($pathKey));

        AppSettings::set($pathKey, null);
        AppSettings::set($versionKey, (string) time());
        MediaDisk::delete($oldPath);

        return self::state();
    }

    /**
     * Путь к загруженной иконке приложения.
     *
     * @return string|null
     */
    public static function appIconPath(): ?string
    {
        return self::cleanPath(AppSettings::get(self::APP_ICON_PATH_KEY));
    }

    /**
     * MIME-тип загруженной иконки приложения.
     *
     * @return string
     */
    public static function appIconMime(): string
    {
        $path = self::appIconPath();
        $extension = $path === null ? '' : strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($extension) {
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'image/png',
        };
    }

    /**
     * Сохранить файл и обновить настройки пары «путь + версия».
     *
     * @param UploadedFile $file загруженный файл
     * @param string $prefix префикс имени файла
     * @param string $pathKey ключ настройки пути
     * @param string $versionKey ключ настройки версии
     * @return array<string, mixed> обновлённое состояние
     */
    private static function store(UploadedFile $file, string $prefix, string $pathKey, string $versionKey): array
    {
        $extension = strtolower($file->getClientOriginalExtension() ?: 'png');
        $name = $prefix.'-'.Str::random(20).'.'.$extension;
        $path = $file->storeAs('branding', $name, MediaDisk::disk());

        if (! is_string($path) || $path === '') {
            abort(422, 'Не удалось сохранить файл. Попробуйте ещё раз.');
        }

        $oldPath = self::cleanPath(AppSettings::get($pathKey));

        AppSettings::set($pathKey, $path);
        AppSettings::set($versionKey, (string) time());
        MediaDisk::delete($oldPath);

        return self::state();
    }

    /**
     * Добавить к URL версию, чтобы браузер не показывал старый файл.
     *
     * @param string|null $url публичный URL файла
     * @param string $version версия из настроек
     * @return string|null
     */
    private static function versionedUrl(?string $url, string $version): ?string
    {
        if ($url === null || $url === '') {
            return null;
        }

        $separator = str_contains($url, '?') ? '&' : '?';

        return $url.$separator.'v='.$version;
    }

    /**
     * Нормализовать путь из настройки.
     *
     * @param string|null $path сырое значение
     * @return string|null
     */
    private static function cleanPath(?string $path): ?string
    {
        $clean = trim((string) $path);

        return $clean === '' ? null : $clean;
    }
}
