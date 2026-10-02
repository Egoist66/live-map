<?php

namespace App\Jobs;

use App\Models\User;
use App\Services\TelegramNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Отложенная досылка непрочитанных сообщений в Telegram-бота.
 *
 * Ставится с задержкой 4 минуты при закрытии приложения и при скипе
 * `online`: сообщения, пришедшие в 3-минутный грейс онлайна после закрытия,
 * в момент отправки не дублируются (получатель ещё «онлайн»), а к моменту
 * срабатывания задачи грейс уже истёк — обычные гейты и дедуп внутри
 * TelegramNotifier::flushUnread решают, что дослать. Пустая выборка —
 * тихий no-op. Задача никогда не кидает исключений наружу очереди.
 */
class FlushTelegramUnread implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    /**
     * Максимум попыток: задача идемпотентна, ретраи безопасны.
     */
    public int $tries = 3;

    /**
     * @param int $userId id получателя (users.id)
     */
    public function __construct(
        public int $userId,
    ) {
    }

    /**
     * Дослать непрочитанное через обычные гейты.
     *
     * @return void
     */
    public function handle(): void
    {
        $user = User::find($this->userId);

        if (! $user) {
            return;
        }

        try {
            TelegramNotifier::flushUnread($user);
        } catch (\Throwable) {
            // No-op: досылка необязательна, основной поток не трогаем.
        }
    }
}
