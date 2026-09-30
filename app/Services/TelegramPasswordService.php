<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Выдача пароля для входа с компьютера через Telegram-бота.
 *
 * Контекст: при автовходе через Mini App пароль генерируется случайным
 * (40 символов, только хеш в базе) — восстановить его нельзя, можно лишь
 * выпустить новый. Логин при этом технический: tg_{id}@telegram.local.
 *
 * Безопасность:
 * - выдать может только владелец: получателя находим строго по telegram_id
 *   из апдейта, а вебхук сверяет секрет Telegram;
 * - двухшаговость: сначала экран-подтверждение (pwd_ask), пароль
 *   генерируется только по явному тапу «Показать»;
 * - антидаблклик: слот резервируем атомарным Cache::add до генерации —
 *   второй быстрый тап упрётся в кулдаун и не инвалидирует первый пароль;
 * - кулдаун 10 минут между выдачами (флуд/перебор чужих рук на экране);
 * - пароль уходит прямой отправкой TelegramBotApi::sendMessage, а не через
 *   очередь SendTelegramMessage — иначе открытый текст лежал бы в хранилище
 *   очереди до обработки; в логах текст тоже не пишем, только user_id;
 * - пароль живёт отдельным сообщением с кнопкой «убрать с экрана»: любой
 *   тап (скрыть, меню, команды) правит сообщение и стирает пароль из чата.
 */
class TelegramPasswordService
{
    /**
     * Кулдаун между выдачами пароля, секунд.
     */
    public const COOLDOWN_SECONDS = 600;

    /**
     * Ключ резервации выдачи в кеше.
     *
     * @param int $userId id пользователя
     * @return string
     */
    public static function cacheKey(int $userId): string
    {
        return 'tg:pwd:'.$userId;
    }

    /**
     * Сколько секунд осталось до следующей доступной выдачи.
     *
     * @param User $user владелец
     * @return int 0 когда выдавать можно
     */
    public static function cooldownLeft(User $user): int
    {
        $since = (int) Cache::get(self::cacheKey((int) $user->id), 0);

        if ($since <= 0) {
            return 0;
        }

        $left = self::COOLDOWN_SECONDS - (time() - $since);

        return $left > 0 ? $left : 0;
    }

    /**
     * Экран-подтверждение: что произойдёт при выпуске пароля.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function ask(User $user): array
    {
        $fresh = $user->fresh() ?? $user;
        $login = trim((string) ($fresh->email ?? ''));

        $lines = [];
        $lines[] = '🔑 <b>Пароль для входа с компьютера</b>';
        $lines[] = '';
        $lines[] = 'Логин: '.($login !== '' ? '<code>'.self::esc($login).'</code>' : '—');
        $lines[] = '';
        $lines[] = 'При входе через Telegram пароль создался сам, поэтому его никто не знает — даже вы. По кнопке ниже выпущу новый:';
        $lines[] = '• старый пароль от сайта перестанет работать;';
        $lines[] = '• новый покажу <b>один раз</b> следующим сообщением;';
        $lines[] = '• сеансы в приложении не слетят.';

        $keyboard = [
            [
                ['text' => '🔑 Показать новый пароль', 'callback_data' => 'pwd_show'],
            ],
        ];

        return ['text' => implode("\n", $lines), 'keyboard' => TelegramMenu::withNav($keyboard)];
    }

    /**
     * Выпустить новый пароль: сгенерировать, сохранить хеш, собрать письмо.
     *
     * Слот кулдауна резервируем атомарно до генерации — повторный тап,
     * пришедший раньше отправки, получит отказ, а не второй пароль поверх.
     * Если отправка в Telegram не удалась, слот снимаем, чтобы человек мог
     * попробовать сразу, а не ждал кулдаун с несработавшей выдачей.
     *
     * @param User $user владелец
     * @return array{ok:bool, password:string, text:string, keyboard:array<int, array<int, array<string, mixed>>>, retry_after:int}
     */
    public static function issue(User $user): array
    {
        $userId = (int) $user->id;
        $key = self::cacheKey($userId);

        $reserved = Cache::add($key, time(), self::COOLDOWN_SECONDS);

        if (! $reserved) {
            return [
                'ok' => false,
                'password' => '',
                'text' => '',
                'keyboard' => [],
                'retry_after' => self::cooldownLeft($user),
            ];
        }

        $password = Str::password(16, true, true, false, false);

        $fresh = $user->fresh() ?? $user;
        $fresh->forceFill(['password' => Hash::make($password)])->save();

        $login = trim((string) ($fresh->email ?? ''));

        $lines = [];
        $lines[] = '🔑 <b>Ваш пароль для входа с компьютера</b>';
        $lines[] = '';
        $lines[] = 'Логин: '.($login !== '' ? '<code>'.self::esc($login).'</code>' : '—');
        $lines[] = 'Пароль: <code>'.self::esc($password).'</code> (тап — скопировать)';
        $lines[] = '';
        $lines[] = '⚠️ Никому не пересылайте это сообщение. Сохранили — жмите кнопку ниже, пароль исчезнет с экрана. Старый пароль от сайта больше не работает.';

        $keyboard = [
            [
                ['text' => '🙈 Я сохранил — убрать с экрана', 'callback_data' => 'pwd_hide'],
            ],
            TelegramMenu::backRow(),
        ];

        return [
            'ok' => true,
            'password' => $password,
            'text' => implode("\n", $lines),
            'keyboard' => $keyboard,
            'retry_after' => 0,
        ];
    }

    /**
     * Снять резерв выдачи (когда отправка в Telegram не удалась).
     *
     * @param User $user владелец
     * @return void
     */
    public static function release(User $user): void
    {
        Cache::forget(self::cacheKey((int) $user->id));
    }

    /**
     * Заглушка после скрытия: пароль уже не на экране.
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function hidden(): array
    {
        $text = "🙈 Пароль убран с экрана.\nНужен снова — выдача через /password (пауза 10 минут между выдачами).";

        $keyboard = TelegramMenu::withNav([
            [TelegramMenu::openAppButton('🌐 Открыть приложение')],
        ]);

        return ['text' => $text, 'keyboard' => $keyboard];
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private static function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
