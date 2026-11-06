<?php

namespace App\Console\Commands;

use App\Events\NotificationInboxChanged;
use App\Models\ExpoPushToken;
use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Одноразовая операция: очистить inbox и заглушить все внешние каналы
 * уведомлений у пользователей, пришедших из Telegram.
 *
 * Целевая аудитория — все, у кого выставлен telegram_id (автосозданные
 * ботом и обычные, кто привязал бот). Как договорились:
 *
 * ОЧИСТКА (необратимо):
 * - все строки таблицы notifications этих пользователей;
 * - web-push подписки (PushSubscription) и Expo-токены устройств
 *   (ExpoPushToken) — без них пуш отправить некому.
 *
 * ЗАГЛУШКА (на будущее):
 * - Telegram-уведомления: мастер telegram_notify_enabled и все
 *   категории (messages/likes/matches/comments/news/invites/reviews);
 * - почтовые дубли email_notify_* (messages/likes/matches).
 * In-app инбокс продолжает работать: тосты и колокольчик внутри
 * приложения остаются (выбранный вариант «Все каналы», без «Всё + inbox»).
 *
 * Кеш бейджей и реалтайм: после очистки счётчик колокольчика сбрасывается,
 * онлайн-клиентам уходит NotificationInboxChanged, чтобы бейджи погасли
 * сразу. Офлайн-клиенты перечитают серверную правду при открытии.
 *
 * @example
 * php artisan notifications:mute-telegram --force
 */
class MuteTelegramNotifications extends Command
{
    /**
     * Сколько минут после последней активности считать клиент онлайн.
     *
     * Офлайн-клиенту событие не отправляем: при открытии он сам
     * перечитает серверное состояние.
     */
    private const ONLINE_WINDOW_MINUTES = 15;

    /**
     * Размер порции пользователей в одном цикле очистки.
     */
    private const CHUNK_SIZE = 500;

    /**
     * @var string
     */
    protected $signature = 'notifications:mute-telegram {--force : Не спрашивать подтверждение}';

    /**
     * @var string
     */
    protected $description = 'Очищает уведомления и глушит все внешние каналы (telegram/push/email) у пользователей с telegram_id';

    /**
     * Выполнить очистку и заглушение.
     *
     * @return int код завершения
     */
    public function handle(): int
    {
        $telegramUserIds = User::query()
            ->whereNotNull('telegram_id')
            ->pluck('id');

        if ($telegramUserIds->isEmpty()) {
            $this->info('Пользователей с telegram_id нет — делать нечего.');

            return self::SUCCESS;
        }

        if (! $this->confirmRun($telegramUserIds)) {
            $this->warn('Отменено.');

            return self::SUCCESS;
        }

        $stats = [
            'users' => 0,
            'notifications' => 0,
            'push' => 0,
            'expo' => 0,
            'muted' => 0,
        ];

        $progress = $this->output->createProgressBar($telegramUserIds->count());
        $progress->start();

        foreach ($telegramUserIds->chunk(self::CHUNK_SIZE) as $chunk) {
            $chunkIds = $chunk->all();

            $stats['notifications'] += $this->clearNotifications($chunkIds);
            $stats['push'] += $this->clearPushSubscriptions($chunkIds);
            $stats['expo'] += $this->clearExpoTokens($chunkIds);
            $stats['muted'] += $this->muteChannels($chunk, $chunkIds);

            foreach ($chunkIds as $userId) {
                Cache::forget("realtime:badges:{$userId}");
            }

            $this->wakeOnline($chunkIds);

            $stats['users'] += count($chunkIds);
            $progress->advance(count($chunkIds));
        }

        $progress->finish();
        $this->newLine(2);

        $this->info(sprintf(
            'Готово. Пользователей затронуто: %d. Уведомлений удалено: %d. Push-подписок удалено: %d. Expo-токенов удалено: %d. Заглушено каналов у новых пользователей: %d.',
            $stats['users'],
            $stats['notifications'],
            $stats['push'],
            $stats['expo'],
            $stats['muted'],
        ));

        return self::SUCCESS;
    }

    /**
     * Спросить подтверждение, если не передан --force.
     *
     * @param  \Illuminate\Support\Collection<int, int>  $userIds id затрагиваемых пользователей
     * @return bool true — продолжаем
     */
    private function confirmRun(\Illuminate\Support\Collection $userIds): bool
    {
        if ($this->option('force')) {
            return true;
        }

        $this->info(sprintf('Будут затронуты пользователи: %d.', $userIds->count()));
        $this->warn('Строки notifications, push-подписки и expo-токены этих пользователей будут удалены безвозвратно.');
        $this->warn('Telegram-тумблеры сброшены в OFF, почтовые дубли email_notify_* отключены. In-app инбокс продолжает работать.');

        return $this->confirm('Продолжить?');
    }

    /**
     * Удалить все уведомления порции пользователей.
     *
     * @param  int[]  $userIds id пользователей порции
     * @return int число удалённых строк
     */
    private function clearNotifications(array $userIds): int
    {
        $morph = (new User)->getMorphClass();

        return DB::table('notifications')
            ->where('notifiable_type', $morph)
            ->whereIn('notifiable_id', $userIds)
            ->delete();
    }

    /**
     * Удалить web-push подписки порции пользователей.
     *
     * @param  int[]  $userIds id пользователей порции
     * @return int число удалённых строк
     */
    private function clearPushSubscriptions(array $userIds): int
    {
        return PushSubscription::query()
            ->whereIn('user_id', $userIds)
            ->delete();
    }

    /**
     * Удалить Expo-токены устройств порции пользователей.
     *
     * @param  int[]  $userIds id пользователей порции
     * @return int число удалённых строк
     */
    private function clearExpoTokens(array $userIds): int
    {
        return ExpoPushToken::query()
            ->whereIn('user_id', $userIds)
            ->delete();
    }

    /**
     * Заглушить все внешние каналы уведомлений порции пользователей.
     *
     * @param  \Illuminate\Support\Collection<int, int>  $chunk порция id (для подсчёта)
     * @param  int[]  $chunkIds id пользователей порции
     * @return int число заглушенных пользователей
     */
    private function muteChannels(\Illuminate\Support\Collection $chunk, array $chunkIds): int
    {
        User::query()
            ->whereIn('id', $chunkIds)
            ->update([
                'telegram_notify_enabled' => false,
                'telegram_notify_messages' => false,
                'telegram_notify_likes' => false,
                'telegram_notify_matches' => false,
                'telegram_notify_comments' => false,
                'telegram_notify_news' => false,
                'telegram_notify_invites' => false,
                'telegram_notify_reviews' => false,
                'email_notify_messages' => false,
                'email_notify_likes' => false,
                'email_notify_matches' => false,
            ]);

        return $chunk->count();
    }

    /**
     * Разбудить онлайн-клиентов порции, чтобы бейджи погасли сразу.
     *
     * @param  int[]  $userIds id пользователей порции
     */
    private function wakeOnline(array $userIds): void
    {
        $since = now()->subMinutes(self::ONLINE_WINDOW_MINUTES);
        $onlineIds = User::query()
            ->whereIn('id', $userIds)
            ->where('last_seen_at', '>=', $since)
            ->pluck('id');

        foreach ($onlineIds as $userId) {
            NotificationInboxChanged::dispatchFor((int) $userId, true);
        }
    }
}
