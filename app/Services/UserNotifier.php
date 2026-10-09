<?php

namespace App\Services;

use App\Events\NotificationCreated;
use App\Models\User;
use App\Models\UserDatabaseNotification;
use App\Notifications\UserNotification;
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
                $existing = $model::where('notifiable_type', $user->getMorphClass())
                    ->where('notifiable_id', $user->getKey())
                    ->where('type', $type)
                    ->where('key', $key)
                    ->whereNull('read_at')
                    ->latest('updated_at')
                    ->first();
                if ($existing) {
                    $existing->forceFill([
                        'data' => $notification->payload((string) $existing->id),
                        'category' => $notification->category(),
                    ])->save();
                    $existing->touch();
                    static::dispatch($user, $existing->fresh(), $notification);

                    return $existing->fresh();
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
            Log::warning('notification send failed', ['type' => $notification->type(), 'error' => $e->getMessage()]);

            return null;
        }
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
