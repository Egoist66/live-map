<?php

namespace App\Services;

use App\Models\User;

/**
 * Панель «Моя почта» для Telegram-бота.
 *
 * Контекст: регистрация через Mini App создаёт технический логин
 * `tg_{id}@telegram.local` — письма туда не дойдут. Здесь показываем
 * текущую почту, статус подтверждения и просим прислать новую
 * следующим сообщением (бот ждёт текст после кнопки «Указать почту»).
 */
class TelegramEmailPanel
{
    /**
     * Собрать текст и клавиатуру панели почты.
     *
     * @param User $user владелец
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function build(User $user): array
    {
        $fresh = $user->fresh() ?? $user;

        $email = trim((string) ($fresh->email ?? ''));
        $isTechnical = $fresh->hasTechnicalTelegramEmail();
        $verified = $fresh->hasVerifiedEmail();

        $lines = [];
        $lines[] = '📧 <b>Моя почта для уведомлений</b>';

        if ($email === '') {
            $lines[] = 'Почта не задана — уведомления на почту не придут.';
        } else {
            $lines[] = 'Текущая: <code>'.self::esc($email).'</code>';
        }

        if ($isTechnical) {
            $lines[] = '';
            $lines[] = '⚠️ Сейчас стоит технический логин Telegram — это не настоящая почта. Укажите свою основную почту, чтобы приходили «лайкнули», «мэтч» и сообщения.';
        } elseif ($verified) {
            $lines[] = '✅ Подтверждена — уведомления на почту доходят.';
        } else {
            $lines[] = '';
            $lines[] = '⏳ Не подтверждена — письмо со ссылкой уже отправлено. Перейдите по ссылке из письма, иначе лайки и сообщения останутся закрыты.';
        }

        $lines[] = '';
        $lines[] = 'Нажмите «Указать почту» и пришлите адрес следующим сообщением — я его сохраню и отправлю подтверждение.';

        $keyboard = [
            [
                ['text' => '📧 Указать почту', 'callback_data' => 'email_ask'],
            ],
            [
                ['text' => '🔄 Обновить статус', 'callback_data' => 'go_email'],
                TelegramMenu::openAppButton('🌐 Открыть настройки'),
            ],
        ];

        return [
            'text' => implode("\n", $lines),
            'keyboard' => TelegramMenu::withNav($keyboard),
        ];
    }

    /**
     * Экран ожидания адреса после тапа «Указать почту».
     *
     * @return array{text:string, keyboard:array<int, array<int, array<string, mixed>>>}
     */
    public static function ask(): array
    {
        $text = "📧 Пришлите вашу основную почту <b>следующим сообщением</b> (например, name@example.com).\n\nЯ сохраню её как контактную, сброшу старое подтверждение и отправлю новую ссылку — перейдите по ней, чтобы уведомления приходили корректно.";

        $keyboard = [
            [
                ['text' => '◀️ К почте', 'callback_data' => 'go_email'],
            ],
        ];

        return [
            'text' => $text,
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
