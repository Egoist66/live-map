<?php

namespace App\Console\Commands;

use App\Events\NotificationInboxChanged;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Принудительно гасит все уведомления и непрочитанные сообщения у всех.
 *
 * Одноразовая административная операция: inbox-строки получают read_at,
 * входящие сообщения — read_at/delivered_at, участники диалогов —
 * last_read_at. Кеш бейджей каждого затронутого пользователя сбрасывается,
 * чтобы счётчики исчезли без ожидания пятисекундного TTL.
 *
 * @example
 * php artisan notifications:read-all --force
 */
class ReadAllNotifications extends Command
{
    /**
     * Сколько минут после последней активности считать клиент онлайн.
     *
     * Офлайн-клиенту событие не нужно: при открытии он всё равно делает
     * fetch и получает уже погашенные счётчики.
     */
    private const ONLINE_WINDOW_MINUTES = 15;

    /**
     * @var string
     */
    protected $signature = 'notifications:read-all {--force : Не спрашивать подтверждение}';

    /**
     * @var string
     */
    protected $description = 'Помечает все уведомления и входящие сообщения прочитанными у всех пользователей';

    /**
     * Выполнить массовое погашение.
     *
     * @return int код завершения
     */
    public function handle(): int
    {
        if (! $this->option('force') && ! $this->confirm('Пометить ВСЕ уведомления и входящие сообщения прочитанными у всех пользователей?')) {
            $this->warn('Отменено.');

            return self::SUCCESS;
        }

        $now = now();

        // updated_at не трогаем: иначе вся старая история разом
        // поднимется наверх ленты, которая сортируется по updated_at.
        $notifications = DB::table('notifications')
            ->whereNull('read_at')
            ->update(['read_at' => $now]);

        $messages = DB::table('messages')
            ->whereNull('read_at')
            ->update(['read_at' => $now]);

        $delivered = DB::table('messages')
            ->whereNull('delivered_at')
            ->update(['delivered_at' => $now]);

        $participants = DB::table('conversation_participants')
            ->update(['last_read_at' => $now]);

        $userIds = $this->affectedUserIds();
        $forgotten = $this->forgetBadgeCaches($userIds);
        $woken = $this->broadcastInboxChanged($userIds);

        $this->info("Уведомления: {$notifications}, сообщения: {$messages}, доставлено: {$delivered}, участники: {$participants}, кешей сброшено: {$forgotten}, онлайн-клиентов разбужено: {$woken}.");

        return self::SUCCESS;
    }

    /**
     * Пользователи, чьи счётчики могла изменить очистка.
     *
     * @return Collection<int, int> уникальные id получателей и участников чатов
     */
    private function affectedUserIds(): Collection
    {
        $morph = (new User)->getMorphClass();

        $notifiedIds = DB::table('notifications')
            ->where('notifiable_type', $morph)
            ->distinct()
            ->pluck('notifiable_id');

        $participantIds = DB::table('conversation_participants')
            ->distinct()
            ->pluck('user_id');

        return $notifiedIds
            ->merge($participantIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();
    }

    /**
     * Сбросить кеш бейджей всех пользователей, которых коснулась очистка.
     *
     * @param  Collection<int, int>  $userIds  получатели и участники чатов
     * @return int число сброшенных ключей
     */
    private function forgetBadgeCaches(Collection $userIds): int
    {
        $forgotten = 0;

        foreach ($userIds->chunk(500) as $chunk) {
            foreach ($chunk as $userId) {
                Cache::forget("realtime:badges:{$userId}");
                $forgotten++;
            }
        }

        return $forgotten;
    }

    /**
     * Разбудить онлайн-клиентов, чтобы бейджи погасли сразу.
     *
     * Без события соседняя вкладка и телефон узнают о массовом прочтении
     * только через минутный сторож бейджей. Офлайн-пользователей не трогаем:
     * их клиент перечитает серверную правду при открытии.
     *
     * @param  Collection<int, int>  $userIds  получатели и участники чатов
     * @return int число разосланных событий
     */
    private function broadcastInboxChanged(Collection $userIds): int
    {
        if ($userIds->isEmpty()) {
            return 0;
        }

        $since = now()->subMinutes(self::ONLINE_WINDOW_MINUTES);
        $woken = 0;

        foreach ($userIds->chunk(500) as $chunk) {
            $onlineIds = User::query()
                ->whereIn('id', $chunk->all())
                ->where('last_seen_at', '>=', $since)
                ->pluck('id');

            foreach ($onlineIds as $userId) {
                NotificationInboxChanged::dispatchFor((int) $userId, true);
                $woken++;
            }
        }

        return $woken;
    }
}
