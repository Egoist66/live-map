<?php

namespace App\Services;

use App\Mail\NewUserRegisteredMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Почтовые уведомления команде проекта.
 *
 * Список получателей собирается из администраторов и чистится от
 * дублей/невалидных ящиков, плюс подмешивается fallback из конфига
 * (mail.admin_address → seo.support_email → mail.from.address).
 */
class AdminNotifier
{
    /**
     * Email-адреса администраторов без дублей и мусора.
     *
     * @return string[] нормализованные адреса
     */
    public static function emails(): array
    {
        $emails = User::where('is_admin', true)
            ->orWhere('role', 'admin')
            ->pluck('email')
            ->all();

        $fallback = config('mail.admin_address')
            ?? config('seo.support_email')
            ?? config('mail.from.address');

        if ($fallback) {
            $emails[] = $fallback;
        }

        $clean = [];

        foreach ($emails as $email) {
            $normalized = mb_strtolower(trim((string) $email));

            if ($normalized === '' || ! filter_var($normalized, FILTER_VALIDATE_EMAIL)) {
                continue;
            }

            $clean[$normalized] = $normalized;
        }

        return array_values($clean);
    }

    /**
     * Письмо админам о регистрации нового пользователя.
     *
     * Шлём каждому ящику отдельно; ошибки SMTP глотаем с warning-логом,
     * потому что сбой почты не должен ломать регистрацию пользователя.
     *
     * @param User $user зарегистрированный пользователь
     * @param string $channel источник регистрации: web|telegram
     * @return void
     */
    public static function newUserRegistered(User $user, string $channel = 'web'): void
    {
        $registeredAt = $user->created_at?->toIso8601String();

        foreach (static::emails() as $to) {
            try {
                Mail::to($to)->send(new NewUserRegisteredMail(
                    userName: (string) $user->name,
                    userEmail: (string) $user->email,
                    accountType: (string) ($user->account_type ?? 'person'),
                    signupGoal: (string) ($user->signup_goal ?? ''),
                    channel: $channel,
                    registeredAt: $registeredAt,
                    telegramUsername: $user->telegram_username,
                ));
            } catch (\Throwable $e) {
                Log::warning('new user mail failed', [
                    'user' => $user->id,
                    'to' => $to,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }
}
