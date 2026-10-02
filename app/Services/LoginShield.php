<?php

namespace App\Services;

use App\Models\LoginAttempt;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Щит логина: заморозка за 3 фейла, автобан за 4, сброс по разбану.
 */
class LoginShield
{
    public const COOLDOWN_FAILS = 3;
    public const COOLDOWN_MINUTES = 60;
    public const BAN_FAILS = 4;

    public static function normalizeEmail(?string $email): string
    {
        return mb_strtolower(trim((string) $email));
    }

    public static function consecutiveFails(string $email): array
    {
        $email = self::normalizeEmail($email);
        $lastSuccess = LoginAttempt::where('email', $email)->where('successful', true)->max('created_at');
        $q = LoginAttempt::where('email', $email)->where('successful', false);
        if ($lastSuccess) $q->where('created_at', '>', $lastSuccess);
        $fails = (clone $q)->count();
        $lastFailAt = (clone $q)->max('created_at');
        return ['count' => $fails, 'last_at' => $lastFailAt ? \Carbon\Carbon::parse($lastFailAt) : null];
    }

    public static function check(string $email, ?User $user): void
    {
        if ($user && $user->banned_at) {
            throw ValidationException::withMessages([
                'email' => 'Аккаунт заблокирован. Обратитесь к администратору.',
            ]);
        }
        if ($user && $user->isAdmin()) return;
        $st = self::consecutiveFails($email);
        if ($st['count'] >= self::COOLDOWN_FAILS && $st['last_at']) {
            $retryAt = $st['last_at']->copy()->addMinutes(self::COOLDOWN_MINUTES);
            if ($retryAt->isFuture()) {
                $mins = max(1, (int) ceil(now()->diffInSeconds($retryAt) / 60));
                throw ValidationException::withMessages([
                    'email' => "Слишком много неверных попыток. Вход заморожен, повторите через {$mins} мин.",
                ]);
            }
        }
    }

    public static function recordSuccess(string $email, ?string $ip, ?string $ua, ?int $userId): void
    {
        try {
            LoginAttempt::create([
                'email' => self::normalizeEmail($email),
                'user_id' => $userId,
                'ip' => $ip,
                'user_agent' => $ua ? mb_substr($ua, 0, 512) : null,
                'successful' => true,
            ]);
        } catch (\Throwable) {
        }
    }

    /**
     * Статус входа по email: сколько фейлов подряд, заморожен ли, когда оттает.
     *
     * @param string $email сырой email
     * @return array{count:int,last_at:?\Carbon\Carbon,frozen_until:?\Carbon\Carbon,is_frozen:bool,retry_mins:int}
     */
    public static function status(string $email): array
    {
        $normalized = self::normalizeEmail($email);

        $state = self::consecutiveFails($normalized);

        $count = (int) ($state['count'] ?? 0);

        /** @var ?\Carbon\Carbon $lastAt */
        $lastAt = $state['last_at'] ?? null;

        $frozenUntil = null;
        $isFrozen = false;
        $retryMins = 0;

        $isPastCooldown = $lastAt
            ? $lastAt->copy()->addMinutes(self::COOLDOWN_MINUTES)->isPast()
            : true;

        if ($count >= self::COOLDOWN_FAILS && $lastAt && ! $isPastCooldown) {
            $frozenUntil = $lastAt->copy()->addMinutes(self::COOLDOWN_MINUTES);

            $isFrozen = true;

            $retryMins = max(1, (int) ceil(now()->diffInSeconds($frozenUntil) / 60));
        }

        return [
            'count' => $count,
            'last_at' => $lastAt,
            'frozen_until' => $frozenUntil,
            'is_frozen' => $isFrozen,
            'retry_mins' => $retryMins,
        ];
    }

    /**
     * Статусы сразу для пачки email (один запрос на каждый агрегат, без N+1).
     *
     * @param string[] $emails сырые email
     * @return array<string,array{count:int,frozen_until:?string,is_frozen:bool,retry_mins:int}>
     */
    public static function statusMap(array $emails): array
    {
        $normalizedList = array_values(
            array_unique(
                array_filter(
                    array_map(fn ($e) => self::normalizeEmail((string) $e), $emails)
                )
            )
        );

        if ($normalizedList === []) {
            return [];
        }

        $lastSuccessByEmail = LoginAttempt::whereIn('email', $normalizedList)
            ->where('successful', true)
            ->selectRaw('email, MAX(created_at) as last_success')
            ->groupBy('email')
            ->pluck('last_success', 'email')
            ->all();

        $failRows = LoginAttempt::whereIn('email', $normalizedList)
            ->where('successful', false)
            ->selectRaw('email, COUNT(*) as c, MAX(created_at) as last_fail')
            ->groupBy('email')
            ->get();

        $now = now();
        $map = [];

        foreach ($normalizedList as $email) {
            $map[$email] = [
                'count' => 0,
                'frozen_until' => null,
                'is_frozen' => false,
                'retry_mins' => 0,
            ];
        }

        foreach ($failRows as $row) {
            $email = (string) $row->email;
            $lastSuccess = $lastSuccessByEmail[$email] ?? null;

            if ($lastSuccess) {
                $failsAfterSuccess = LoginAttempt::where('email', $email)
                    ->where('successful', false)
                    ->where('created_at', '>', $lastSuccess)
                    ->count();

                $lastFailAt = LoginAttempt::where('email', $email)
                    ->where('successful', false)
                    ->where('created_at', '>', $lastSuccess)
                    ->max('created_at');

                $count = (int) $failsAfterSuccess;
                $lastFailRaw = $lastFailAt;
            } else {
                $count = (int) $row->c;
                $lastFailRaw = $row->last_fail;
            }

            $lastAt = $lastFailRaw ? \Carbon\Carbon::parse($lastFailRaw) : null;

            $isFrozen = false;
            $frozenUntilIso = null;
            $retryMins = 0;

            if ($count >= self::COOLDOWN_FAILS && $lastAt) {
                $retryAt = $lastAt->copy()->addMinutes(self::COOLDOWN_MINUTES);

                if ($retryAt->isFuture()) {
                    $isFrozen = true;
                    $frozenUntilIso = $retryAt->toISOString();
                    $retryMins = max(1, (int) ceil($now->diffInSeconds($retryAt) / 60));
                }
            }

            $map[$email] = [
                'count' => $count,
                'frozen_until' => $frozenUntilIso,
                'is_frozen' => $isFrozen,
                'retry_mins' => $retryMins,
            ];
        }

        return $map;
    }

    /**
     * Полный сброс защиты после разбана/сброса админом.
     *
     * Разбан без сброса оставлял «Слишком много попыток, попробуйте через N мин»:
     * счётчик consecutiveFails жил в login_attempts, а Breeze-хиты — в RateLimiter
     * по ключу email|ip. Поэтому чистим оба: вставляем success-маркер (рвёт цепочку
     * фейлов, история при этом сохраняется) и снимаем RateLimiter по всем известным IP.
     *
     * @param string $email email пользователя
     * @param int|null $userId id пользователя для маркера
     * @param string|null $note пометка в user_agent маркера
     * @return void
     */
    public static function thaw(string $email, ?int $userId = null, ?string $note = null): void
    {
        $normalized = self::normalizeEmail($email);

        $ips = [];

        try {
            $ips = LoginAttempt::where('email', $normalized)
                ->whereNotNull('ip')
                ->distinct()
                ->pluck('ip')
                ->all();
        } catch (\Throwable) {
            $ips = [];
        }

        foreach ($ips as $ip) {
            $key = Str::transliterate(Str::lower($normalized).'|'.((string) $ip));

            try {
                RateLimiter::clear($key);
            } catch (\Throwable) {
            }
        }

        try {
            LoginAttempt::create([
                'email' => $normalized,
                'user_id' => $userId,
                'ip' => null,
                'user_agent' => mb_substr($note ?? 'admin:thaw — сброс заморозки и счётчика фейлов', 0, 512),
                'successful' => true,
            ]);
        } catch (\Throwable) {
        }
    }

    public static function recordFail(string $email, ?string $ip, ?string $ua, ?User $user): array
    {
        $geo = IpGeolocation::lookup($ip);
        try {
            LoginAttempt::create([
                'email' => self::normalizeEmail($email),
                'user_id' => $user?->id,
                'ip' => $ip,
                'country' => $geo['country'],
                'country_code' => $geo['country_code'],
                'city' => $geo['city'],
                'user_agent' => $ua ? mb_substr($ua, 0, 512) : null,
                'successful' => false,
            ]);
        } catch (\Throwable) {
        }
        $st = self::consecutiveFails($email);
        $result = ['fails' => $st['count'], 'banned' => false];
        if ($user && !$user->isAdmin() && !$user->banned_at && $st['count'] >= self::BAN_FAILS) {
            $user->forceFill([
                'banned_at' => now(),
                'banned_reason' => 'Автобан: '.self::BAN_FAILS.' неверные попытки входа',
            ])->saveQuietly();
            $result['banned'] = true;
        }
        return $result;
    }
}
