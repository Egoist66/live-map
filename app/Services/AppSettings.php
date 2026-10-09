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

    /**
     * Модули, глобально включённые администратором.
     *
     * По умолчанию только ULove: остальные разделы (карта, лента,
     * районы, бизнес) выдаются отдельными патчами через админку.
     * ULove присутствует всегда, даже если ключ ещё не записан.
     *
     * @return string[] список из ulove|upin|uflow|districts|business
     */
    public static function globalModules(): array
    {
        $allowed = ['ulove', 'upin', 'uflow', 'districts', 'business'];

        try {
            $raw = self::get('modules.global_enabled', null);

            if ($raw === null || $raw === '') {
                return ['ulove'];
            }

            $decoded = json_decode((string) $raw, true);

            if (! is_array($decoded)) {
                return ['ulove'];
            }

            $clean = array_values(array_intersect(array_map('strval', $decoded), $allowed));

            if (! in_array('ulove', $clean, true)) {
                array_unshift($clean, 'ulove');
            }

            return $clean === [] ? ['ulove'] : $clean;
        } catch (\Throwable) {
            return ['ulove'];
        }
    }

    /**
     * Включён ли модуль глобально (виден ли пользователям вообще).
     *
     * @param string $module ulove|upin|uflow|districts|business
     * @return bool
     */
    public static function isModuleGloballyEnabled(string $module): bool
    {
        if ($module === 'ulove') {
            return true;
        }

        return in_array($module, self::globalModules(), true);
    }

    /**
     * Сохраняет глобальный набор модулей (только из админки).
     *
     * ULove принудительно остаётся первым: выключить его нельзя.
     *
     * @param string[] $modules желаемый набор
     * @return string[] очищенный набор
     */
    public static function setGlobalModules(array $modules): array
    {
        $allowed = ['ulove', 'upin', 'uflow', 'districts', 'business'];
        $clean = array_values(array_intersect(array_map('strval', $modules), $allowed));

        $rest = array_values(array_diff($clean, ['ulove']));
        $next = array_merge(['ulove'], $rest);

        self::set('modules.global_enabled', json_encode($next, JSON_UNESCAPED_UNICODE));

        return $next;
    }

    public static function maintenancePage(): array
    {
        return [
            'title' => self::get('maintenance.title') ?: 'Технические работы',
            'message' => self::get('maintenance.message') ?: 'Мы скоро вернёмся.',
        ];
    }
}
