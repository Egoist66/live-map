<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserDatabaseNotification;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Log;

/**
 * Гейт уведомлений по модулям приложения.
 *
 * Правило: уведомление летит, только если у получателя включён
 * модуль-владелец типа. ULove и чат — базовые: их типы (dating.*,
 * сообщения диалогов) гейт пропускает всегда. Без модуля нет ни
 * строки в inbox, ни realtime-тоста, ни пуша, ни дубля в TG-бота.
 *
 * Семьи типов без привязки к отключаемому разделу (профиль, фото,
 * друзья, безопасность, новости приложения, поддержка, награды)
 * пропускаются всегда: это базовый социальный слой, а не раздел.
 *
 * @see UserNotifier::send() единая точка inbox + realtime + push
 */
class NotificationModuleGate
{
    /**
     * Префикс типа → модуль-владелец.
     *
     * Бизнес-типы (business.*, cooperation.*) сознательно вне гейта:
     * вердикты проверки и заявки нужны владельцам и стаффу всегда,
     * независимо от тумблеров разделов — это аккаунтные события,
     * а не контент отключаемого раздела.
     *
     * @var array<string, string>
     */
    private const PREFIX_MODULES = [
        'pin.' => 'upin',
        'flow.' => 'uflow',
        'district.' => 'districts',
        'sos.' => 'upin',
    ];

    /**
     * Модуль-владелец типа уведомления.
     *
     * @param string $type тип из UserNotification::type()
     * @return string|null модуль или null для базовых типов
     */
    public static function moduleForType(string $type): ?string
    {
        foreach (self::PREFIX_MODULES as $prefix => $module) {
            if (str_starts_with($type, $prefix)) {
                return $module;
            }
        }

        return null;
    }

    /**
     * Можно ли доставить уведомление получателю.
     *
     * Базовые типы (чат, ULove, профиль, безопасность, новости) —
     * всегда да. Модульные — только при включённом разделе
     * (legacy-аккаунты видят всё глобально включённое автоматически
     * через User::hasModule).
     *
     * @param User $user получатель
     * @param string $type тип уведомления
     * @return bool
     */
    public static function allows(User $user, string $type): bool
    {
        $module = self::moduleForType($type);

        if ($module === null) {
            return true;
        }

        try {
            return $user->hasModule($module);
        } catch (\Throwable $e) {
            Log::warning('notification module gate failed', [
                'user_id' => $user->getKey(),
                'type' => $type,
                'error' => $e->getMessage(),
            ]);

            return true;
        }
    }

    /**
     * Вырезает из запроса строки разделов, выключенных у пользователя.
     *
     * Для inbox-ленты и счётчиков: история чужих разделов не должна
     * светиться тем, у кого раздел выключен. Неизвестные будущие типы
     * не трогаем — режем только известные семьи.
     *
     * @param EloquentBuilder|QueryBuilder $query запрос по notifications
     * @param User $user владелец ленты
     * @return EloquentBuilder|QueryBuilder тот же запрос с фильтрами
     */
    public static function applyAllowedScope(EloquentBuilder|QueryBuilder $query, User $user): EloquentBuilder|QueryBuilder
    {
        foreach (self::PREFIX_MODULES as $prefix => $module) {
            try {
                $enabled = $user->hasModule($module);
            } catch (\Throwable) {
                continue;
            }

            if (! $enabled) {
                $query->where('type', 'not like', $prefix.'%');
            }
        }

        return $query;
    }

    /**
     * Гасит непрочитанные строки выключенных разделов.
     *
     * Вызывается при смене набора модулей: выключил раздел —
     * его уведомления пропадают из бейджей и ленты как прочитанные.
     * Пишет в обе inbox-модели (обычную и шифрованную).
     *
     * @param User $user владелец ленты
     * @param string[] $removedModules выключенные модули
     * @return int сколько строк помечено
     */
    public static function markDisabledRead(User $user, array $removedModules): int
    {
        $removed = array_values(array_unique(array_map('strval', $removedModules)));

        if ($removed === []) {
            return 0;
        }

        $prefixes = [];

        foreach (self::PREFIX_MODULES as $prefix => $module) {
            if (in_array($module, $removed, true)) {
                $prefixes[] = $prefix;
            }
        }

        if ($prefixes === []) {
            return 0;
        }

        $marked = 0;

        foreach ([DatabaseNotification::class, UserDatabaseNotification::class] as $model) {
            try {
                $query = $model::where('notifiable_type', $user->getMorphClass())
                    ->where('notifiable_id', $user->getKey())
                    ->whereNull('read_at')
                    ->where(function ($inner) use ($prefixes) {
                        foreach ($prefixes as $index => $prefix) {
                            if ($index === 0) {
                                $inner->where('type', 'like', $prefix.'%');
                            } else {
                                $inner->orWhere('type', 'like', $prefix.'%');
                            }
                        }
                    });

                $marked += $query->update(['read_at' => now()]);
            } catch (\Throwable $e) {
                Log::warning('notification dismiss failed', [
                    'user_id' => $user->getKey(),
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $marked;
    }
}
