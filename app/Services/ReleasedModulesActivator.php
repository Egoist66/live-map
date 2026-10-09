<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Доактивация выпущенных разделов у существующих пользователей.
 *
 * Когда администратор включает раздел глобально, одного тумблера
 * в настройках мало: пользователь с явным списком модулей
 * (enabled_modules = ['ulove']) новый раздел не увидит включённым.
 * Этот сервис дописывает выпущенные модули в конец чужих списков:
 * стартовый экран (primary, первый элемент) не меняется, выключить
 * раздел обратно пользователь может сам в настройках «Приложение».
 *
 * Legacy-аккаунты (enabled_modules = NULL) трогать не нужно: они
 * видят все глобально включённые разделы автоматически.
 *
 * Массовое обновление идёт через query builder чанками: без событий
 * модели и без трогания updated_at, чтобы не шуметь в сортировках
 * по активности и не дёргать хуки слагов.
 */
class ReleasedModulesActivator
{
    /**
     * Разрешённые идентификаторы модулей.
     *
     * @var string[]
     */
    private const ALLOWED = ['ulove', 'upin', 'uflow', 'districts', 'business'];

    /**
     * Дописывает модули всем пользователям с явным списком.
     *
     * @param string[] $modules модули для активации (обычно дифф глобального набора)
     * @return int сколько пользователей реально обновлено
     */
    public static function activate(array $modules): int
    {
        $wanted = array_values(array_intersect(array_map('strval', $modules), self::ALLOWED));

        if ($wanted === []) {
            return 0;
        }

        $touched = 0;

        try {
            DB::table('users')
                ->whereNotNull('enabled_modules')
                ->select(['id', 'enabled_modules'])
                ->chunkById(500, function ($rows) use ($wanted, &$touched) {
                    foreach ($rows as $row) {
                        $merged = self::mergedList($row->enabled_modules, $wanted);

                        if ($merged === null) {
                            continue;
                        }

                        DB::table('users')
                            ->where('id', $row->id)
                            ->update(['enabled_modules' => json_encode($merged, JSON_UNESCAPED_UNICODE)]);

                        $touched++;
                    }
                });
        } catch (\Throwable $e) {
            Log::warning('released modules activation failed', [
                'modules' => $wanted,
                'touched' => $touched,
                'error' => $e->getMessage(),
            ]);
        }

        return $touched;
    }

    /**
     * Сливает текущий список с выпускаемыми модулями.
     *
     * Чистит мусор (неизвестные id, дубли), новые модули дописывает
     * в конец — primary пользователя не меняется.
     *
     * @param mixed $raw сырое значение колонки enabled_modules
     * @param string[] $wanted модули для активации
     * @return string[]|null готовый список или null, если трогать нечего
     */
    private static function mergedList(mixed $raw, array $wanted): ?array
    {
        $decoded = is_string($raw) ? json_decode($raw, true) : null;

        if (! is_array($decoded)) {
            return null;
        }

        $seen = [];
        $clean = [];

        foreach ($decoded as $item) {
            $module = is_string($item) ? trim(mb_strtolower($item)) : '';

            if ($module !== '' && in_array($module, self::ALLOWED, true) && ! isset($seen[$module])) {
                $seen[$module] = true;
                $clean[] = $module;
            }
        }

        if ($clean === []) {
            return null;
        }

        $missing = array_values(array_diff($wanted, $clean));

        if ($missing === []) {
            return null;
        }

        return array_merge($clean, $missing);
    }
}
