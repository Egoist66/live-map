<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Переключение аккаунтов в Telegram-боте.
 *
 * Контекст: один telegram_id привязан к одному пользователю, а у человека
 * может быть второй аккаунт, зарегистрированный через сайт (почта+пароль).
 * «Переключиться» = перенести привязку telegram_id на другой аккаунт.
 *
 * Безопасный обмен — только по одноразовому коду: владелец второго
 * аккаунта генерирует 6-значный код в браузере/Mini App
 * (POST /api/telegram/switch-code), затем присылает его боту сюда.
 * По голой почте переключать нельзя — иначе любой мог бы угнать чужую
 * привязку, просто назвав чужой email.
 */
class TelegramAccountSwitch
{
    /**
     * Сколько живёт код переключения, секунд (10 минут).
     */
    public const CODE_TTL_SECONDS = 600;

    /**
     * Длина кода (нули слева значимы, храним строкой).
     */
    public const CODE_LENGTH = 6;

    /**
     * Ключ кода в кеше.
     *
     * @param string $code 6 цифр
     * @return string
     */
    public static function codeKey(string $code): string
    {
        return 'tg:switch:code:'.$code;
    }

    /**
     * Ключ ожидания кода от этого Telegram.
     *
     * @param int $telegramId from.id апдейта
     * @return string
     */
    public static function waitKey(int $telegramId): string
    {
        return 'tg:switch:wait:'.$telegramId;
    }

    /**
     * Сгенерировать одноразовый код для текущего пользователя.
     *
     * Код короткий (6 цифр), поэтому перед записью проверяем коллизию:
     * чужой код перезаписывать нельзя, генерим заново.
     *
     * @param User $user владелец второго аккаунта (залогинен на сайте)
     * @return string 6 цифр
     */
    public static function makeCode(User $user): string
    {
        for ($attempt = 0; $attempt < 10; $attempt++) {
            $code = (string) random_int(0, 999999);
            $code = str_pad($code, self::CODE_LENGTH, '0', STR_PAD_LEFT);

            $taken = false;

            try {
                $taken = Cache::has(self::codeKey($code));
            } catch (\Throwable) {
                $taken = false;
            }

            if ($taken) {
                continue;
            }

            try {
                Cache::put(self::codeKey($code), (int) $user->id, self::CODE_TTL_SECONDS);
            } catch (\Throwable) {
                return $code;
            }

            return $code;
        }

        $fallback = str_pad((string) random_int(0, 999999), self::CODE_LENGTH, '0', STR_PAD_LEFT);

        try {
            Cache::put(self::codeKey($fallback), (int) $user->id, self::CODE_TTL_SECONDS);
        } catch (\Throwable) {
        }

        return $fallback;
    }

    /**
     * Перенести привязку telegram_id на аккаунт-владелец кода.
     *
     * Код одноразовый: успешное и неуспешное (чужой TG уже занят целью)
     * потребление его не сжигает, сжигает только успешный переезд —
     * иначе опечатка в цифре съедала бы рабочий код.
     *
     * @param string $code 6 цифр из бота
     * @param int $telegramId from.id апдейта (куда переносим привязку)
     * @return User аккаунт, к которому теперь привязан Telegram
     *
     * @throws \RuntimeException когда код неверный/протух или цель занята другим TG
     */
    public static function consumeCode(string $code, int $telegramId): User
    {
        $clean = preg_replace('/\D/', '', $code) ?? '';
        $clean = str_pad($clean, self::CODE_LENGTH, '0', STR_PAD_LEFT);
        $clean = substr($clean, -self::CODE_LENGTH);

        $targetId = null;

        try {
            $targetId = Cache::get(self::codeKey($clean));
        } catch (\Throwable) {
            $targetId = null;
        }

        if ($targetId === null) {
            throw new \RuntimeException('Код не найден или протух. Сгенерируйте новый на сайте и попробуйте снова.');
        }

        $target = User::find((int) $targetId);

        if ($target === null) {
            throw new \RuntimeException('Аккаунт для кода больше не существует.');
        }

        $currentTargetTg = (int) ($target->telegram_id ?? 0);

        if ($currentTargetTg !== 0 && $currentTargetTg !== $telegramId) {
            throw new \RuntimeException('Этот аккаунт уже привязан к другому Telegram. Сначала отвяжите его там.');
        }

        if ($currentTargetTg === $telegramId) {
            try {
                Cache::forget(self::codeKey($clean));
            } catch (\Throwable) {
            }

            return $target->fresh() ?? $target;
        }

        $holders = User::where('telegram_id', $telegramId)
            ->where('id', '!=', $target->id)
            ->get();

        foreach ($holders as $holder) {
            $holder->forceFill([
                'telegram_id' => null,
                'telegram_username' => null,
                'telegram_photo_url' => null,
                'telegram_linked_at' => null,
            ])->saveQuietly();
        }

        $target->forceFill([
            'telegram_id' => $telegramId,
            'telegram_linked_at' => now(),
            'telegram_blocked_at' => null,
        ])->save();

        try {
            Cache::forget(self::codeKey($clean));
        } catch (\Throwable) {
        }

        return $target->fresh() ?? $target;
    }

    /**
     * Запомнить ожидание кода (после кнопки «Переключиться»).
     *
     * @param int $telegramId from.id апдейта
     * @return void
     */
    public static function rememberWait(int $telegramId): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::put(self::waitKey($telegramId), true, self::CODE_TTL_SECONDS);
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Ждём ли код от этого Telegram.
     *
     * @param int $telegramId from.id апдейта
     * @return bool
     */
    public static function isWait(int $telegramId): bool
    {
        if ($telegramId <= 0) {
            return false;
        }

        try {
            return (bool) Cache::get(self::waitKey($telegramId), false);
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Снять ожидание кода.
     *
     * @param int $telegramId from.id апдейта
     * @return void
     */
    public static function forgetWait(int $telegramId): void
    {
        if ($telegramId <= 0) {
            return;
        }

        try {
            Cache::forget(self::waitKey($telegramId));
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Похож ли текст на код переключения (ровно 6 цифр).
     *
     * @param string $text сырой текст сообщения
     * @return bool
     */
    public static function looksLikeCode(string $text): bool
    {
        return preg_match('/^\d{6}$/', trim($text)) === 1;
    }
}
