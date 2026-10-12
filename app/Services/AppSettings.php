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
     * районы, бизнес) включаются администратором глобально.
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
     * Выпущен ли хоть один дополнительный раздел (карта, лента, районы, бизнес).
     *
     * Система очков и рангов за активность живёт только с допразделами:
     * пока дефолт — чистый ULove, она скрыта (таб заданий, итог недели).
     * Очки при этом копятся как обычно — к релизу ничего не потеряется.
     *
     * @return bool
     */
    public static function isActivityReleased(): bool
    {
        foreach (['upin', 'uflow', 'districts', 'business'] as $module) {
            if (in_array($module, self::globalModules(), true)) {
                return true;
            }
        }

        return false;
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

    /**
     * Включён ли весь ИИ-функционал глобально.
     *
     * Дефолт — выключен: пользователи ничего ИИшного не видят,
     * пока администратор явно не включит тумблер в админке.
     * Гейт строгий: выключен — не видит никто, включая staff
     * (виджеты UPin AI, кнопка гида в профиле, диалог гида,
     * API гида — всё закрыто одним флагом).
     *
     * @return bool
     */
    public static function isAiEnabled(): bool
    {
        return self::get('ai.enabled', '0') === '1';
    }

    /**
     * Сохраняет глобальный тумблер ИИ (только из админки).
     *
     * @param bool $enabled включить или выключить
     * @return bool итоговое состояние
     */
    public static function setAiEnabled(bool $enabled): bool
    {
        $next = $enabled ? '1' : '0';
        self::set('ai.enabled', $next);

        return $next === '1';
    }

    public static function maintenancePage(): array
    {
        return [
            'title' => self::get('maintenance.title') ?: 'Технические работы',
            'message' => self::get('maintenance.message') ?: 'Мы скоро вернёмся.',
        ];
    }
}
