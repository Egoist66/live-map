<?php

namespace App\Services;

/**
 * Версия собранного фронтенда.
 *
 * Используется чтобы показать кнопку «Обновить» после каждого деплоя
 * (push в Laravel Cloud -> новый билд -> другой хэш manifest.json).
 */
class AppVersionService
{
    /**
     * Текущая версия билда.
     *
     * @return string
     */
    public static function version(): string
    {
        $fromEnv = (string) env('APP_VERSION', '');

        if ($fromEnv !== '') {
            return $fromEnv;
        }

        $manifest = public_path('build/manifest.json');

        if (is_file($manifest)) {
            $hash = @hash_file('xxh128', $manifest);

            if (is_string($hash) && $hash !== '') {
                return $hash;
            }
        }

        return (string) config('app.key', 'dev');
    }

    /**
     * Время сборки билда (mtime manifest.json).
     *
     * @return int|null
     */
    public static function builtAt(): ?int
    {
        $manifest = public_path('build/manifest.json');

        if (! is_file($manifest)) {
            return null;
        }

        $mtime = @filemtime($manifest);

        return $mtime === false ? null : $mtime;
    }
}
