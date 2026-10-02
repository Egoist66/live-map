<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Аккаунт» Telegram-бота: кто сейчас привязан + переключение.
 *
 * Показывает текущий логин (почта + TG-username) и объясняет обмен
 * по одноразовому коду: код генерируется на сайте вторым аккаунтом,
 * затем присылается сюда — привязка переезжает без паролей в чате.
 */
class TelegramAccountPanel
{
    /**
     * Собрать текст и клавиатуру панели аккаунта.
     *
     * @param User $user привязанный пользователь
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $name = trim((string) ($fresh->name ?? ''));

        if ($name === '') {
            $name = 'Без имени';
        }

        $email = trim((string) ($fresh->email ?? ''));
        $tgUsername = trim((string) ($fresh->telegram_username ?? ''));

        $lines = [];
        $lines[] = '🔀 <b>Аккаунт в боте</b>';
        $lines[] = '';
        $lines[] = 'Сейчас: <b>'.self::esc($name).'</b>';

        if ($email !== '') {
            $lines[] = 'Логин: <code>'.self::esc($email).'</code>';
        }

        if ($tgUsername !== '') {
            $lines[] = 'Telegram: @'.self::esc($tgUsername);
        }

        $lines[] = '';
        $lines[] = 'Есть второй аккаунт с сайта? Переключитесь без пароля в чате:';
        $lines[] = '1. Войдите вторым аккаунтом на сайте;';
        $lines[] = '2. Сгенерируйте код (Настройки → Приложение → Telegram → «Код для бота»);';
        $lines[] = '3. Нажмите кнопку ниже и пришлите 6 цифр сюда — привязка переедет.';

        $showBack = ! TelegramAccountSwitch::isDefaultAccount($fresh);

        if ($showBack) {
            $lines[] = '';
            $lines[] = 'Вы сейчас во втором аккаунте — одной кнопкой можно выйти из него и вернуться в свой Telegram-аккаунт.';
        }

        $keyboard = [
            [
                ['text' => '🔀 Переключиться по коду', 'callback_data' => 'acc_ask'],
            ],
        ];

        if ($showBack) {
            $keyboard[] = [
                ['text' => '↩️ Вернуться в Telegram-аккаунт', 'callback_data' => 'acc_back'],
            ];
        }

        $keyboard[] = [
            ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
            TelegramMenu::openAppButton('🌐 Открыть приложение'),
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экран ожидания кода после тапа «Переключиться».
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function ask(): array
    {
        $text = "🔀 Пришлите код из 6 цифр <b>следующим сообщением</b>.\n\nКод живёт 10 минут и одноразовый: после переключения он сгорает. Не получилось — сгенерируйте новый на сайте.";

        $keyboard = [
            [
                ['text' => '◀️ К аккаунту', 'callback_data' => 'go_account'],
            ],
        ];

        return [
            'text' => $text,
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экран подтверждения возврата в Telegram-аккаунт.
     *
     * @param User $user текущий (второй) пользователь
     * @param int $telegramId from.id апдейта
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function askBack(User $user, int $telegramId): array
    {
        $fresh = $user->fresh() ?? $user;

        $currentName = trim((string) ($fresh->name ?? ''));

        if ($currentName === '') {
            $currentName = 'Без имени';
        }

        $defaultEmail = TelegramAccountSwitch::defaultEmail($telegramId);

        $lines = [];
        $lines[] = '↩️ <b>Вернуться в Telegram-аккаунт?</b>';
        $lines[] = '';
        $lines[] = 'Сейчас бот работает с: <b>'.self::esc($currentName).'</b>';
        $lines[] = 'Вернёмся в: <code>'.self::esc($defaultEmail).'</code>';
        $lines[] = '';
        $lines[] = 'Второй аккаунт не удалится — с него просто снимется привязка к этому Telegram.';

        $keyboard = [
            [
                ['text' => '✅ Да, вернуться', 'callback_data' => 'acc_back_yes'],
            ],
            [
                ['text' => '◀️ К аккаунту', 'callback_data' => 'go_account'],
            ],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
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
