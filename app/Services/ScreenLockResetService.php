<?php

namespace App\Services;

use App\Events\ScreenLockReset;
use App\Mail\ScreenLockResetCodeMail;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Сброс забытого кода скринлокера.
 *
 * Сам код блокировки живёт только на устройстве (IndexedDB), поэтому
 * «сброс» — это серверная метка `screen_lock_reset_at`: устройство видит,
 * что метка новее его локальной записи, и стирает код. Доступ к сбросу
 * подтверждается владением аккаунтом: 6-значным кодом на почту или
 * через привязанный Telegram (владение ботом = владение аккаунтом).
 *
 * Сервер знает только boolean `is_sl_active` — чтобы бот мог показать
 * пункт «Сброс скринлокера» лишь тем, у кого локер реально включён.
 */
class ScreenLockResetService
{
    /** Сколько живёт код из письма. */
    public const CODE_TTL_SECONDS = 600;

    /** Пауза между повторными отправками кода. */
    public const CODE_RESEND_SECONDS = 60;

    /** Сколько раз можно ошибиться, прежде чем код сгорит. */
    public const CODE_MAX_ATTEMPTS = 5;

    /**
     * Сообщить серверу, включён ли локер на этом устройстве.
     *
     * Значение account-level и last-write-wins: устройство шлёт true при
     * сохранении и загрузке включённого локера, false — при выключении.
     *
     * @param User $user владелец настройки
     * @param bool $active включён ли скринлокер
     * @return void
     */
    public static function setActive(User $user, bool $active): void
    {
        if ((bool) ($user->is_sl_active ?? false) === $active) {
            return;
        }

        // toBase(), а не save(): смена флага не должна двигать updated_at
        // (иначе контакты увидят «изменение профиля» в polling) и рассылать
        // profile.updated.
        try {
            User::query()
                ->whereKey($user->getKey())
                ->toBase()
                ->update(['is_sl_active' => $active]);
        } catch (\Throwable $e) {
            // Миграция ещё не применена — локер продолжает работать
            // на устройстве, просто бот не узнает о флаге.
            Log::warning('screen lock active flag update failed: '.$e->getMessage());

            return;
        }

        $user->setAttribute('is_sl_active', $active);
        $user->syncOriginalAttribute('is_sl_active');
    }

    /**
     * Отправить код сброса на почту пользователя.
     *
     * @param User $user владелец аккаунта
     * @return array{ok:bool,retry_after:int,message:string}
     */
    public static function issueCode(User $user): array
    {
        $userId = (int) $user->id;
        $email = trim((string) ($user->email ?? ''));

        if ($email === '' || $user->hasTechnicalTelegramEmail()) {
            return [
                'ok' => false,
                'retry_after' => 0,
                'message' => 'У аккаунта нет рабочей почты — сбрось код через Telegram-бота.',
            ];
        }

        if (Cache::has(self::cooldownKey($userId))) {
            return [
                'ok' => false,
                'retry_after' => self::cooldownLeft($userId),
                'message' => 'Код уже отправлен — подожди минуту перед повторной отправкой.',
            ];
        }

        $code = (string) random_int(100000, 999999);

        Cache::put(self::codeKey($userId), [
            'hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addSeconds(self::CODE_TTL_SECONDS)->timestamp,
        ], self::CODE_TTL_SECONDS);

        try {
            Mail::to($email)->send(new ScreenLockResetCodeMail($code, (int) (self::CODE_TTL_SECONDS / 60)));
        } catch (\Throwable $e) {
            Cache::forget(self::codeKey($userId));

            Log::warning('screen lock reset code mail failed', [
                'to' => $email,
                'exception' => get_class($e),
                'error' => $e->getMessage(),
            ]);

            report($e);

            return [
                'ok' => false,
                'retry_after' => 0,
                'message' => 'Не удалось отправить письмо. Попробуй через Telegram-бота.',
            ];
        }

        Cache::put(self::cooldownKey($userId), time(), self::CODE_RESEND_SECONDS);

        return ['ok' => true, 'retry_after' => 0, 'message' => ''];
    }

    /**
     * Проверить код из письма и выполнить сброс.
     *
     * @param User $user владелец аккаунта
     * @param string $code 6-значный код из письма
     * @return array{ok:bool,message:string,reset_at:int}
     */
    public static function verifyCode(User $user, string $code): array
    {
        $userId = (int) $user->id;
        $payload = self::codePayload($userId);

        if ($payload === null) {
            return ['ok' => false, 'message' => 'Код не найден или истёк — запроси новый.', 'reset_at' => 0];
        }

        if (($payload['attempts'] ?? 0) >= self::CODE_MAX_ATTEMPTS) {
            Cache::forget(self::codeKey($userId));

            return ['ok' => false, 'message' => 'Слишком много попыток. Запроси новый код.', 'reset_at' => 0];
        }

        if (! Hash::check($code, (string) ($payload['hash'] ?? ''))) {
            $payload['attempts'] = ($payload['attempts'] ?? 0) + 1;
            $ttl = max(1, (int) $payload['expires_at'] - now()->timestamp);
            Cache::put(self::codeKey($userId), $payload, $ttl);
            $left = self::CODE_MAX_ATTEMPTS - $payload['attempts'];

            return ['ok' => false, 'message' => "Неверный код. Осталось попыток: {$left}.", 'reset_at' => 0];
        }

        $resetAt = self::reset($user);

        if ($resetAt <= 0) {
            return ['ok' => false, 'message' => 'Не удалось сбросить локер. Попробуй через Telegram-бота.', 'reset_at' => 0];
        }

        return ['ok' => true, 'message' => '', 'reset_at' => $resetAt];
    }

    /**
     * Сбросить код скринлокера: пометить аккаунт и разослать метку устройствам.
     *
     * @param User $user владелец аккаунта
     * @return int метка сброса в миллисекундах
     */
    public static function reset(User $user): int
    {
        $resetAt = now();

        try {
            // toBase(): сброс — не изменение профиля, не двигаем updated_at
            // и не шлём контактам profile.updated.
            User::query()
                ->whereKey($user->getKey())
                ->toBase()
                ->update([
                    'is_sl_active' => false,
                    'screen_lock_reset_at' => $resetAt,
                ]);
        } catch (\Throwable $e) {
            Log::warning('screen lock reset mark failed: '.$e->getMessage());

            return 0;
        }

        $user->setAttribute('is_sl_active', false);
        $user->syncOriginalAttribute('is_sl_active');
        $user->setAttribute('screen_lock_reset_at', $resetAt);
        $user->syncOriginalAttribute('screen_lock_reset_at');

        Cache::forget(self::codeKey((int) $user->id));
        Cache::forget(self::cooldownKey((int) $user->id));

        $mark = $resetAt->valueOf();

        try {
            ScreenLockReset::dispatch((int) $user->id, $mark);
        } catch (\Throwable $e) {
            // Reverb недоступен — устройства подхватят метку из polling.
            Log::warning('screen lock reset broadcast failed: '.$e->getMessage());
        }

        return $mark;
    }

    /**
     * Сколько секунд осталось до повторной отправки кода.
     *
     * @param int $userId владелец
     * @return int 0 — можно отправлять
     */
    private static function cooldownLeft(int $userId): int
    {
        $since = (int) Cache::get(self::cooldownKey($userId), 0);

        if ($since <= 0) {
            return 0;
        }

        $left = self::CODE_RESEND_SECONDS - (time() - $since);

        return $left > 0 ? $left : 0;
    }

    /**
     * Достать живой payload кода.
     *
     * @param int $userId владелец
     * @return array{hash:string,attempts:int,expires_at:int}|null
     */
    private static function codePayload(int $userId): ?array
    {
        $payload = Cache::get(self::codeKey($userId));

        if (! is_array($payload) || empty($payload['hash'])) {
            return null;
        }

        if ((int) ($payload['expires_at'] ?? 0) <= now()->timestamp) {
            Cache::forget(self::codeKey($userId));

            return null;
        }

        return $payload;
    }

    /**
     * Ключ кэша с кодом сброса.
     *
     * @param int $userId владелец
     * @return string
     */
    private static function codeKey(int $userId): string
    {
        return "screen_lock_reset_code:{$userId}";
    }

    /**
     * Ключ кэша кулдауна отправки.
     *
     * @param int $userId владелец
     * @return string
     */
    private static function cooldownKey(int $userId): string
    {
        return "screen_lock_reset_cooldown:{$userId}";
    }
}
