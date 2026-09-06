<?php

namespace App\Services;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Cache;

class AppSettings
{
    public static function get(string $key, ?string $default = null): ?string
    {
        try {
            return Cache::rememberForever('appsettings:'.$key, fn () => AppSetting::whereKey($key)->value('value') ?? $default);
        } catch (\Throwable) {
            return $default;
        }
    }

    public static function set(string $key, ?string $value): void
    {
        AppSetting::updateOrCreate(['key' => $key], ['value' => $value]);
        Cache::forget('appsettings:'.$key);
    }

    public static function maintenanceEnabled(): bool
    {
        return self::get('maintenance.enabled', '0') === '1';
    }

    public static function maintenancePage(): array
    {
        return [
            'title' => self::get('maintenance.title') ?: 'Технические работы',
            'message' => self::get('maintenance.message') ?: 'Мы скоро вернёмся.',
        ];
    }
}
