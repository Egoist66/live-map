<?php

namespace App\Services;

use App\Models\User;

/**
 * Общая навигация Telegram-бота: главное меню, помощь и ряд «Назад».
 *
 * Зачем отдельный класс: раньше каждая панель рисовала свои кнопки,
 * ряда «◀️ Меню / 📋 Команды» не было нигде — из глубины (лайки, мэтчи,
 * сеансы, уведомления, удаление) можно было выйти только командой /start
 * вручную. Плюс menu_button типа web_app прятал нативный список команд
 * у инпута — команды приходилось вспоминать. Теперь:
 * - главное меню (/start и колбэк go_menu) собирается в одном месте;
 * - помощь со списком всех команд (/help и колбэк go_help) — тоже;
 * - каждая панель внизу получает ряд [◀️ Меню, 📋 Команды] через withNav().
 *
 * Формат callback_data (лимит Bot API — 64 байта):
 * - `go_menu` — перерисовать сообщение в главное меню;
 * - `go_help` — перерисовать в список всех команд;
 * - `go_profile`, `go_likes`, `go_matches`, `go_notify`, `go_sessions`,
 *   `go_stats`, `go_messages` — переходы в разделы без нового сообщения.
 */
class TelegramMenu
{
    /**
     * Собрать главное меню для пользователя.
     *
     * Тот же текст, что раньше жил в replyStart: приветствие + живые
     * счётчики непрочитанных и лайков, чтобы пульт сразу показывал суть.
     *
     * @param User $user привязанный пользователь
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function main(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $name = trim((string) ($fresh->name ?? ''));
        $hello = $name !== '' ? ', '.self::esc($name) : '';

        $unread = TelegramInsights::unreadCount($fresh);
        $admirers = TelegramInsights::admirers($fresh);

        $text = "👋 Привет{$hello}! Я — ваш пульт от ULove.\n"
            .'Могу всё без открытия приложения: анкета, лайки, мэтчи, сообщения, сеансы, пароль для ПК и уведомления.';

        $totalLikes = (int) ($admirers['total'] ?? 0);

        if ($unread > 0 || $totalLikes > 0) {
            $text .= "\n\n";
            $text .= "💬 Новых сообщений: <b>{$unread}</b> · 💞 Лайков: <b>{$totalLikes}</b>";
        }

        $text .= "\n\nВыбирайте кнопку ниже или команду из меню у поля ввода — я всё покажу прямо здесь.";

        $keyboard = [
            [
                ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
                ['text' => '📊 Статистика', 'callback_data' => 'go_stats'],
            ],
            [
                ['text' => '💞 Лайки', 'callback_data' => 'go_likes'],
                ['text' => '🎉 Мэтчи', 'callback_data' => 'go_matches'],
            ],
            [
                ['text' => '🔔 Уведомления', 'callback_data' => 'go_notify'],
                ['text' => '📱 Сеансы', 'callback_data' => 'go_sessions'],
            ],
            [
                ['text' => '💬 Сообщения', 'callback_data' => 'go_messages'],
                ['text' => '📋 Все команды', 'callback_data' => 'go_help'],
            ],
            [
                ['text' => '🔑 Пароль для входа с ПК', 'callback_data' => 'go_password'],
            ],
            [
                self::openAppButton('🌐 Открыть приложение'),
            ],
        ];

        return ['text' => $text, 'keyboard' => $keyboard];
    }

    /**
     * Собрать экран помощи — список всех команд бота.
     *
     * Тот же текст, что отвечает на /help, но с навигацией для
     * перерисовки (колбэк go_help правит сообщение, а не шлёт новое).
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function help(): array
    {
        $lines = [];
        $lines[] = '✨ <b>Что я умею</b>';
        $lines[] = '';
        $lines[] = '👤 /profile — анкета: тариф, счётчики, скрыть/вернуть';
        $lines[] = '🙈 /hide — стать невидимкой (никто не видит)';
        $lines[] = '👀 /show — вернуться в поиск и ленту';
        $lines[] = '💞 /likes — кто лайкнул вашу анкету';
        $lines[] = '🎉 /matches — ваши мэтчи';
        $lines[] = '💬 /messages — непрочитанные сообщения';
        $lines[] = '📊 /stats — уровень, репутация, тариф';
        $lines[] = '🔔 /notify — какие письма слать в личку';
        $lines[] = '📱 /sessions — сеансы: завершить чужой вход, забанить устройство';
        $lines[] = '🔑 /password — логин и новый пароль для входа с компьютера';
        $lines[] = '💔 /delete — удалить профиль (сначала подарим PRO!)';
        $lines[] = '💚 /restore — вернуть профиль в течение 14 дней';
        $lines[] = '';
        $lines[] = 'Всё переключается кнопками прямо здесь — приложение открывать не надо.';
        $lines[] = 'Команды всегда под рукой: кнопка «Меню» у поля ввода или наберите /.';

        $keyboard = [
            [
                ['text' => '◀️ Меню', 'callback_data' => 'go_menu'],
                ['text' => '👤 Моя анкета', 'callback_data' => 'go_profile'],
            ],
            [
                self::openAppButton('🌐 Приложение'),
            ],
        ];

        return ['text' => implode("\n", $lines), 'keyboard' => $keyboard];
    }

    /**
     * Нижний ряд навигации для любой панели.
     *
     * Кладётся последним рядом, чтобы большой палец всегда находил
     * «Назад» в одном месте: [◀️ Меню, 📋 Команды].
     *
     * @return array<int, array<string, mixed>>
     */
    public static function backRow(): array
    {
        return [
            ['text' => '◀️ Меню', 'callback_data' => 'go_menu'],
            ['text' => '📋 Команды', 'callback_data' => 'go_help'],
        ];
    }

    /**
     * Добить клавиатуру панели нижним рядом навигации.
     *
     * Вызывать в самом конце build() панели — ряд добавляется один раз,
     * дубли не копятся (смотрим, нет ли уже go_menu в последнем ряду).
     *
     * @param array<int, array<int, array<string, mixed>>> $keyboard ряды панели
     * @return array<int, array<int, array<string, mixed>>> те же ряды + навигация
     */
    public static function withNav(array $keyboard): array
    {
        $last = end($keyboard);

        if (is_array($last)) {
            foreach ($last as $button) {
                if (is_array($button) && ($button['callback_data'] ?? '') === 'go_menu') {
                    return $keyboard;
                }
            }
        }

        $keyboard[] = self::backRow();

        return $keyboard;
    }

    /**
     * Кнопка открытия Mini App (web_app требует https, иначе url).
     *
     * Единая точка: раньше жила в TelegramSessionsPanel, теперь здесь,
     * чтобы не тянуть зависимость панелей друг на друга.
     *
     * @param string $label подпись кнопки
     * @return array<string, mixed>
     */
    public static function openAppButton(string $label): array
    {
        $base = rtrim((string) config('app.url', ''), '/');
        $url = $base !== '' ? $base.'/?tgWebApp=1' : '';

        if ($url !== '' && str_starts_with($url, 'https://')) {
            return ['text' => $label, 'web_app' => ['url' => $url]];
        }

        if ($url !== '') {
            return ['text' => $label, 'url' => $url];
        }

        return ['text' => $label, 'callback_data' => 'go_menu'];
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
