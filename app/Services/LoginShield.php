<?php

namespace App\Services;

use App\Models\LoginAttempt;
use App\Models\User;
use Illuminate\Validation\ValidationException;

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
