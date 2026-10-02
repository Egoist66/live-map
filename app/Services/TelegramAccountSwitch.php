<?php

namespace App\Services;

use App\Models\User;
use App\Services\AppModulesWelcomeNews;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

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
     * Сколько помним предыдущий аккаунт для кнопки «назад», секунд (30 дней).
     */
    public const PREV_TTL_SECONDS = 2592000;

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

        $previousId = $holders->first()?->id;

        if ($previousId !== null) {
            self::rememberPrevious($telegramId, (int) $previousId);
        }

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

    /**
     * Технический email дефолтного Telegram-аккаунта.
     *
     * Автосозданные через Mini App получают `tg_{id}@telegram.local` —
     * это «дом» владельца Telegram, куда можно вернуться одной кнопкой
     * после переключения на второй аккаунт по коду.
     *
     * @param int $telegramId from.id апдейта
     * @return string
     */
    public static function defaultEmail(int $telegramId): string
    {
        return 'tg_'.$telegramId.'@telegram.local';
    }

    /**
     * Это ли дефолтный Telegram-аккаунт (а не второй, включённый по коду).
     *
     * @param User $user проверяемый пользователь
     * @return bool
     */
    public static function isDefaultAccount(User $user): bool
    {
        $telegramId = (int) ($user->telegram_id ?? 0);

        if ($telegramId <= 0) {
            return false;
        }

        return mb_strtolower(trim((string) $user->email)) === self::defaultEmail($telegramId);
    }

    /**
     * Ключ предыдущего аккаунта для кнопки «назад».
     *
     * @param int $telegramId from.id апдейта
     * @return string
     */
    public static function previousKey(int $telegramId): string
    {
        return 'tg:switch:prev:'.$telegramId;
    }

    /**
     * Запомнить, с какого аккаунта ушли (для возврата одной кнопкой).
     *
     * @param int $telegramId from.id апдейта
     * @param int $userId id аккаунта, который теряет привязку
     * @return void
     */
    public static function rememberPrevious(int $telegramId, int $userId): void
    {
        if ($telegramId <= 0 || $userId <= 0) {
            return;
        }

        try {
            Cache::put(self::previousKey($telegramId), $userId, self::PREV_TTL_SECONDS);
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Вернуться к дефолтному Telegram-аккаунту, выйдя из второго.
     *
     * Безопасно: вызывает только владелец Telegram (from.id апдейта),
     * цель — всегда его собственный автосозданный аккаунт
     * (`tg_{id}@telegram.local`) либо аккаунт, с которого он уходил
     * при последнем переключении. Второй аккаунт не удаляется —
     * с него просто снимается привязка telegram_id.
     *
     * @param int $telegramId from.id апдейта (куда возвращаем привязку)
     * @param array<string, mixed> $tgFrom объект from апдейта (имя для пересоздания)
     * @return array{user:User, created:bool} аккаунт, к которому вернулись
     *
     * @throws \RuntimeException когда уже в дефолтном или некуда вернуться
     */
    public static function backToDefault(int $telegramId, array $tgFrom = []): array
    {
        if ($telegramId <= 0) {
            throw new \RuntimeException('Не вижу ваш Telegram id — откройте бота заново.');
        }

        $current = User::where('telegram_id', $telegramId)->first();

        if ($current !== null && self::isDefaultAccount($current)) {
            throw new \RuntimeException('Вы уже в своём Telegram-аккаунте — возвращаться некуда.');
        }

        $target = User::where('email', self::defaultEmail($telegramId))->first();
        $created = false;

        if ($target === null) {
            $previousId = null;

            try {
                $previousId = Cache::get(self::previousKey($telegramId));
            } catch (\Throwable) {
                $previousId = null;
            }

            if ($previousId !== null) {
                $target = User::find((int) $previousId);
            }

            if ($target === null) {
                $target = self::recreateDefault($telegramId, $tgFrom);
                $created = true;
            }
        }

        $currentTargetTg = (int) ($target->telegram_id ?? 0);

        if ($currentTargetTg !== 0 && $currentTargetTg !== $telegramId) {
            throw new \RuntimeException('Дефолтный аккаунт привязан к другому Telegram. Напишите в поддержку.');
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

        self::forgetWait($telegramId);

        return ['user' => $target->fresh() ?? $target, 'created' => $created];
    }

    /**
     * Пересоздать удалённый дефолтный Telegram-аккаунт.
     *
     * Тот же минимум, что при авторегистрации из Mini App:
     * технический email, случайный пароль, подтверждённая почта.
     *
     * @param int $telegramId from.id апдейта
     * @param array<string, mixed> $tgFrom объект from апдейта
     * @return User созданный пользователь
     */
    private static function recreateDefault(int $telegramId, array $tgFrom = []): User
    {
        $firstName = trim((string) ($tgFrom['first_name'] ?? ''));
        $lastName = trim((string) ($tgFrom['last_name'] ?? ''));
        $fullName = trim($firstName.' '.$lastName);

        if ($fullName === '') {
            $fullName = 'Гость TG';
        }

        $username = ltrim(trim((string) ($tgFrom['username'] ?? '')), '@');

        if ($username !== '' && ! preg_match('/^[A-Za-z0-9_]+$/', $username)) {
            $username = '';
        }

        $user = User::create([
            'name' => mb_substr($fullName, 0, 255),
            'email' => self::defaultEmail($telegramId),
            'password' => Hash::make(Str::random(40)),
            'gender' => 'other',
            'signup_goal' => 'chat',
            'default_mode' => 'ulove',
            'default_mode_set_at' => now(),
            'enabled_modules' => ['ulove'],
            'account_type' => 'person',
            'dating_enabled' => true,
            'telegram_id' => $telegramId,
            'telegram_username' => $username !== '' ? mb_substr($username, 0, 64) : null,
            'telegram_linked_at' => now(),
        ]);

        $user->forceFill(['email_verified_at' => now()])->saveQuietly();

        AppModulesWelcomeNews::ensureDelivered($user);

        return $user;
    }
}
