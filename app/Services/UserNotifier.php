<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Models\User;
use App\Models\UserDatabaseNotification;
use App\Notifications\UserNotification;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Единая точка отправки уведомлений в inbox-таблицу notifications.
 *
 * Правило: одно событие — одна непрочитанная строка на получателя.
 * Повтор с тем же type+key обновляет пейлоад и поднимает запись наверх.
 * Доставка — realtime-broadcast в user.{id} + опциональный web-push
 * из pushPayload() класса. Даблклик/ретрай/сокет+поллер дублей не дают.
 */
class UserNotifier
{
    /**
     * Отправить уведомление пользователю (идемпотентно).
     *
     * Модульный гейт: типы чужих разделов (пины, лента, районы)
     * получателю без этого раздела не создаются вообще —
     * ни строки, ни realtime, ни пуша. См. NotificationModuleGate.
     */
    public static function send(User $user, UserNotification $notification): ?DatabaseNotification
    {
        try {
            if (! NotificationModuleGate::allows($user, $notification->type())) {
                return null;
            }
        } catch (\Throwable) {
            return null;
        }

        try {
            $type = $notification->type();
            $key = $notification->dedupeKey();
            // Админские типы пишутся базовым классом открытым текстом:
            // по ним есть JSON-запросы data->update_id. Пользовательские —
            // шифрованной моделью (пейлоад data в конверте __enc).
            $model = str_starts_with($type, 'app.')
                ? DatabaseNotification::class
                : UserDatabaseNotification::class;
            if ($key !== null) {
                $existing = self::findRow($user, $model, $type, $key, true);

                if ($existing) {
                    return self::refreshRow($user, $existing, $notification);
                }
            }
            $id = (string) Str::uuid();
            $row = new $model();
            $row->forceFill([
                'id' => $id,
                'type' => $type,
                'notifiable_type' => $user->getMorphClass(),
                'notifiable_id' => $user->getKey(),
                'data' => $notification->payload($id),
                'category' => $notification->category(),
                'key' => $key,
                'read_at' => null,
            ]);
            $row->save();
            static::dispatch($user, $row, $notification);

            return $row;
        } catch (\Throwable $e) {
            $recovered = self::recoverDuplicate($user, $notification, $e);

            if ($recovered !== null) {
                return $recovered;
            }

            Log::warning('notification send failed', ['type' => $notification->type(), 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Найти строку по type+key получателя.
     *
     * @param User $user получатель
     * @param string $model класс строки уведомлений
     * @param string $type тип уведомления
     * @param string $key ключ дедупа
     * @param bool $onlyUnread true — только непрочитанные
     * @return DatabaseNotification|null
     */
    private static function findRow(User $user, string $model, string $type, string $key, bool $onlyUnread): ?DatabaseNotification
    {
        $query = $model::where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->getKey())
            ->where('type', $type)
            ->where('key', $key);

        if ($onlyUnread) {
            $query->whereNull('read_at');
        }

        return $query->latest('updated_at')->first();
    }

    /**
     * Обновить строку свежим пейлоадом и поднять наверх.
     *
     * Прочитанную строку воскрешаем (read_at=null): раз событие
     * пришло заново — человеку снова есть что прочитать.
     *
     * @param User $user получатель
     * @param DatabaseNotification $row строка
     * @param UserNotification $notification событие
     * @return DatabaseNotification свежая строка
     */
    private static function refreshRow(User $user, DatabaseNotification $row, UserNotification $notification): DatabaseNotification
    {
        $row->forceFill([
            'data' => $notification->payload((string) $row->id),
            'category' => $notification->category(),
            'read_at' => null,
        ])->save();
        $row->touch();

        $fresh = $row->fresh() ?? $row;

        static::dispatch($user, $fresh, $notification);

        return $fresh;
    }

    /**
     * Подобрать строку после коллизии уникального ключа.
     *
     * Гонка «проверка-затем-вставка» (даблклик, сокет+ретрай) или
     * повтор события по прочитанной строке: вставка упала с 1062,
     * а чужая транзакция строку уже положила. Находим её и обновляем
     * как обычный повтор — вместо warning и потери уведомления.
     *
     * @param User $user получатель
     * @param UserNotification $notification событие
     * @param \Throwable $e ошибка вставки
     * @return DatabaseNotification|null null когда это не коллизия ключа
     */
    private static function recoverDuplicate(User $user, UserNotification $notification, \Throwable $e): ?DatabaseNotification
    {
        if (! self::isDuplicateKey($e)) {
            return null;
        }

        $type = $notification->type();
        $key = $notification->dedupeKey();

        if ($key === null) {
            return null;
        }

        $model = str_starts_with($type, 'app.')
            ? DatabaseNotification::class
            : UserDatabaseNotification::class;

        try {
            $existing = self::findRow($user, $model, $type, $key, false);
        } catch (\Throwable) {
            return null;
        }

        if ($existing === null) {
            return null;
        }

        try {
            return self::refreshRow($user, $existing, $notification);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Это коллизия уникального ключа (а не другая ошибка БД).
     *
     * @param \Throwable $e ошибка
     * @return bool
     */
    private static function isDuplicateKey(\Throwable $e): bool
    {
        if ($e instanceof UniqueConstraintViolationException) {
            return true;
        }

        if ($e instanceof QueryException && (int) $e->getCode() === 23000) {
            return true;
        }

        return str_contains($e->getMessage(), 'Duplicate entry');
    }

    /**
     * Удалить непрочитанный дубль (например generic-коммент при упоминании).
     */
    public static function deleteUnread(int $userId, string $type, string $key): void
    {
        try {
            UserDatabaseNotification::where('notifiable_id', $userId)
                ->where('type', $type)
                ->where('key', $key)
                ->whereNull('read_at')
                ->delete();
        } catch (\Throwable $e) {
            Log::warning('notification cleanup failed', ['type' => $type, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Разослать realtime + web-push для строки.
     */
    private static function dispatch(User $user, DatabaseNotification $row, UserNotification $notification): void
    {
        try {
            broadcast(new NotificationCreated((int) $user->getKey(), static::serialize($row)));
        } catch (\Throwable $e) {
            Log::warning('notification broadcast failed', ['id' => (string) $row->id, 'error' => $e->getMessage()]);
        }
        try {
            $push = $notification->pushPayload();
            if ($push) {
                app(WebPushService::class)->sendToUser($user, $push);
                app(ExpoPushService::class)->sendToUser($user, $push);
            }
        } catch (\Throwable $e) {
            Log::warning('notification webpush failed', ['id' => (string) $row->id, 'error' => $e->getMessage()]);
        }
    }

    /**
     * Проводной формат строки для API и realtime.
     */
    public static function serialize(DatabaseNotification $row): array
    {
        $data = $row->data;
        if (is_string($data)) {
            $decoded = json_decode($data, true);
            $data = is_array($decoded) ? $decoded : [];
        }

        return [
            'id' => (string) $row->id,
            'type' => (string) $row->type,
            'category' => (string) ($row->category ?? 'event'),
            'read_at' => $row->read_at ? $row->read_at->toISOString() : null,
            'created_at' => $row->created_at ? $row->created_at->toISOString() : null,
            'updated_at' => $row->updated_at ? $row->updated_at->toISOString() : null,
            'data' => is_array($data) ? $data : [],
        ];
    }
}
