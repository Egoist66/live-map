<?php

namespace App\Console\Commands;

use App\Jobs\FlushTelegramUnread;
use App\Jobs\SendTelegramMessage;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

/**
 * Диагностика доставки уведомлений чата в Telegram-бота.
 *
 * Отвечает на вопрос «собеседник написал, а в Telegram ничего не пришло».
 * Проверяет всю цепочку: токен бота → привязку telegram_id → 403-блок →
 * мастер-тумблер и тумблер «Сообщения» → гейт онлайна (сообщение уходит
 * только отошедшему получателю) → очередь и висящие задачи.
 *
 * Запуск: php artisan telegram:chat-debug 8
 * Проба мимо очереди и гейта онлайна: php artisan telegram:chat-debug 8 --probe
 */
class DebugChatTelegram extends Command
{
    protected $signature = 'telegram:chat-debug
        {user : users.id, telegram_id, @username, профиль или email получателя}
        {--probe : отправить одно тестовое письмо напрямую, мимо очереди}';

    protected $description = 'Проверить, почему уведомление чата не дошло в Telegram-бота';

    /**
     * Проверить цепочку доставки уведомлений чата получателю.
     *
     * @return int 0 при успешной диагностике (даже если найдены проблемы)
     */
    public function handle(): int
    {
        $needle = trim((string) $this->argument('user'));
        $user = $this->resolveUser($needle);

        if (! $user) {
            $this->error("Пользователь «{$needle}» не найден. Укажите users.id, telegram_id, @username, профиль или email.");

            return self::FAILURE;
        }

        $this->reportUser($user);
        $this->reportQueue($user);
        $this->reportVerdict($user);

        if ((bool) $this->option('probe')) {
            $this->probe($user);
        } else {
            $this->line('Подсказка: --probe отправит тестовое письмо напрямую, мимо очереди и гейта онлайна.');
        }

        return self::SUCCESS;
    }

    /**
     * Найти получателя по id, telegram_id, username, профилю или email.
     *
     * Числовой аргумент сначала трактуем как users.id, затем как telegram_id:
     * так удобно искать и по внутреннему id, и по id из логов Bot API.
     *
     * @param string $needle id, @username, профиль или email
     * @return User|null найденный пользователь или null
     */
    private function resolveUser(string $needle): ?User
    {
        if ($needle === '') {
            return null;
        }

        if (ctype_digit($needle)) {
            $byId = User::find((int) $needle);

            if ($byId !== null) {
                return $byId;
            }

            return User::where('telegram_id', (int) $needle)->first();
        }

        $username = ltrim($needle, '@');

        if ($username === '') {
            return null;
        }

        return User::where('telegram_username', $username)
            ->orWhere('profile_slug', $username)
            ->orWhere('email', $needle)
            ->first();
    }

    /**
     * Показать привязку и тумблеры получателя.
     *
     * @param User $user получатель уведомления
     * @return void
     */
    private function reportUser(User $user): void
    {
        $token = (string) config('telegram.bot_token', '');
        $telegramId = (int) ($user->telegram_id ?? 0);
        $lastSeen = $user->last_seen_at?->toDateTimeString() ?? 'никогда';
        $isAway = $user->isAway();

        $this->table(
            ['Поле', 'Значение'],
            [
                ['Пользователь', "#{$user->id} (".($user->name ?? 'без имени').')'],
                ['TELEGRAM_BOT_TOKEN', $token !== '' ? 'задан (длина '.mb_strlen($token).')' : 'ПУСТ — Bot API недоступен'],
                ['telegram_id', $telegramId > 0 ? (string) $telegramId : 'НЕТ — аккаунт не привязан'],
                ['telegram_blocked_at', $user->telegram_blocked_at?->toDateTimeString() ?? '—'],
                ['telegram_notify_enabled', $this->toggleLabel($user->telegram_notify_enabled)],
                ['telegram_notify_messages', $this->toggleLabel($user->telegram_notify_messages)],
                ['last_seen_at', $lastSeen],
                ['isAway (гейт онлайна)', $isAway ? 'да — письмо уйдёт' : 'НЕТ — получатель онлайн, письмо отложено'],
                ['QUEUE_CONNECTION', (string) config('queue.default', 'database')],
            ]
        );
    }

    /**
     * Показать очередь и задачи, связанные с этим получателем.
     *
     * @param User $user получатель уведомления
     * @return void
     */
    private function reportQueue(User $user): void
    {
        $connection = (string) config('queue.default', 'database');

        $this->line("Очередь: {$connection}");

        if ($connection === 'sync') {
            $this->line('Очередь sync: задачи выполняются сразу, воркер не нужен.');
        } else {
            $this->warn("Очередь {$connection}: нужен живой воркер (Managed queue / queue:work), иначе задачи висят.");
        }

        try {
            $queueSize = Queue::size();
            $this->line("Размер очереди (Queue::size): {$queueSize}");
        } catch (\Throwable $e) {
            $this->line('Queue::size недоступен: '.$e->getMessage());
        }

        $this->reportPendingJobs($user);
    }

    /**
     * Посчитать висящие задачи отправки и отложенного флаша.
     *
     * @param User $user получатель уведомления
     * @return void
     */
    private function reportPendingJobs(User $user): void
    {
        try {
            $jobs = DB::table('jobs')->get(['id', 'queue', 'payload', 'attempts', 'available_at']);
        } catch (\Throwable $e) {
            $this->line('Таблица jobs недоступна: '.$e->getMessage());

            return;
        }

        $sendAll = 0;
        $sendForUser = 0;
        $flushAll = 0;
        $flushForUser = 0;

        foreach ($jobs as $job) {
            $payload = (string) ($job->payload ?? '');

            if (str_contains($payload, SendTelegramMessage::class)) {
                $sendAll++;

                if ($this->payloadBelongsToUser($payload, (int) $user->id)) {
                    $sendForUser++;
                }
            }

            if (str_contains($payload, FlushTelegramUnread::class)) {
                $flushAll++;

                if ($this->payloadBelongsToUser($payload, (int) $user->id)) {
                    $flushForUser++;
                }
            }
        }

        $this->table(
            ['Задача', 'Всего', 'Для этого получателя'],
            [
                ['SendTelegramMessage', $sendAll, $sendForUser],
                ['FlushTelegramUnread', $flushAll, $flushForUser],
            ]
        );

        if ($sendForUser > 0) {
            $this->warn('Письма для этого получателя висят в очереди — воркер их не разбирает. Проверьте Queues / Background processes в Laravel Cloud.');
        }

        try {
            $failed = DB::table('failed_jobs')->count();
            $this->line("Упавших задач (failed_jobs): {$failed}");
        } catch (\Throwable) {
            // Таблица может отсутствовать — не критично для диагностики.
        }
    }

    /**
     * Свести найденные причины в понятный вердикт.
     *
     * @param User $user получатель уведомления
     * @return void
     */
    private function reportVerdict(User $user): void
    {
        $token = (string) config('telegram.bot_token', '');

        if ($token === '') {
            $this->error('Причина: не задан TELEGRAM_BOT_TOKEN — Bot API недоступен.');

            return;
        }

        $telegramId = (int) ($user->telegram_id ?? 0);

        if ($telegramId <= 0) {
            $this->warn('Причина: Telegram не привязан. Получателю нужно открыть Mini App (или /start у @U1ove_bot) и войти через Telegram.');

            return;
        }

        if ($user->telegram_blocked_at !== null) {
            $this->warn('Причина: бот помечен как заблокированный (нет /start или пользователь заблокировал). Нужно нажать /start у @U1ove_bot.');

            return;
        }

        if (! $this->toggleEnabled($user->telegram_notify_enabled)) {
            $this->warn('Причина: выключен мастер-тумблер Telegram-уведомлений (telegram_notify_enabled).');

            return;
        }

        if (! $this->toggleEnabled($user->telegram_notify_messages)) {
            $this->warn('Причина: выключен тумблер «Сообщения» (telegram_notify_messages).');

            return;
        }

        if (! $user->isAway()) {
            $this->warn('Причина: получатель сейчас онлайн (last_seen_at < 3 минут). Уведомление в Telegram откладывается до закрытия Mini App; отложенный флаш тоже требует воркер.');

            return;
        }

        $connection = (string) config('queue.default', 'database');

        if ($connection !== 'sync') {
            $this->warn("Гейты пройдены. Если письма всё равно не приходят — проверьте, что очередь {$connection} реально разбирается воркером (Laravel Cloud → Queues / Background processes).");
        } else {
            $this->info('Гейты пройдены, очередь sync — письмо должно уйти сразу.');
        }
    }

    /**
     * Отправить одно тестовое письмо напрямую, мимо очереди.
     *
     * @param User $user получатель
     * @return void
     */
    private function probe(User $user): void
    {
        $text = 'ULove • проверка доставки уведомлений чата (telegram:chat-debug)';

        $outcome = SendTelegramMessage::attempt((int) $user->id, $text, [], null);
        $status = (string) ($outcome['status'] ?? 'failed');

        $this->info("Итог пробы: {$status}");

        if ($status === 'sent') {
            $this->info('Bot API и привязка в порядке: если автоматические письма не приходят, причина в очереди или гейте онлайна.');
        }

        if ($status === 'blocked') {
            $this->warn('Bot API ответил 403: получателю нужно нажать /start у @U1ove_bot.');
        }

        if ($status === 'retry') {
            $this->warn('Сеть/429/5xx: повторите пробу через минуту и проверьте доступность api.telegram.org с прода.');
        }

        if ($status === 'failed') {
            $this->warn('Отправка не удалась: проверьте TELEGRAM_BOT_TOKEN и telegram_id получателя.');
        }
    }

    /**
     * Подпись значения тумблера: null трактуем как включённый.
     *
     * @param bool|null $value значение из БД
     * @return string
     */
    private function toggleLabel(?bool $value): string
    {
        if ($value === null) {
            return 'не задан (включено)';
        }

        return $value ? 'включён' : 'ВЫКЛЮЧЕН';
    }

    /**
     * Включён ли тумблер с учётом null = включено.
     *
     * @param bool|null $value значение из БД
     * @return bool
     */
    private function toggleEnabled(?bool $value): bool
    {
        return $value === null || $value === true;
    }

    /**
     * Относится ли сериализованная задача к пользователю.
     *
     * Поддерживает PHP-сериализацию (`"userId";i:8`) и JSON (`"userId":8`).
     *
     * @param string $payload тело задачи
     * @param int $userId id получателя
     * @return bool
     */
    private function payloadBelongsToUser(string $payload, int $userId): bool
    {
        $serialized = '"userId";i:'.$userId;
        $json = '"userId":'.$userId;

        return str_contains($payload, $serialized) || str_contains($payload, $json);
    }
}
