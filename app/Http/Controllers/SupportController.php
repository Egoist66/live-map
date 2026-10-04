<?php

namespace App\Http\Controllers;

use App\Mail\SupportRequestMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Обращения в поддержку из настроек приложения.
 *
 * Пользователь пишет тему + сообщение прямо в интерфейсе —
 * админы получают inbox-уведомление (тост + колокольчик + пуш)
 * и письмо на почту через настроенный SMTP (MAIL_MAILER),
 * а не через mailto-ссылку.
 */
class SupportController extends Controller
{
    /**
     * Принять обращение в поддержку от залогиненного пользователя.
     *
     * Имя и email берём из аккаунта (для ответа), тему и текст —
     * из формы. Спам режется троттлом support (6/мин на юзера).
     *
     * @param Request $request тема + сообщение
     * @return JsonResponse ok
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => 'required|string|min:3|max:120',
            'message' => 'required|string|min:10|max:2000',
        ]);

        $me = $request->user();
        $subject = trim($data['subject']);
        $message = trim($data['message']);
        $name = (string) ($me->name ?? 'Пользователь');
        $email = (string) ($me->email ?? '');

        static::notifyAdmins($subject, $message, $name, $email);

        return response()->json(['ok' => true], 201);
    }

    /**
     * Адреса администраторов для писем (как в жалобах и сотрудничестве).
     *
     * Публичный — переиспользуется консольной командой service:email
     * для показа, куда реально уходят письма поддержки.
     *
     * @return string[]
     */
    public static function adminEmails(): array
    {
        $emails = User::where('is_admin', true)->orWhere('role', 'admin')->pluck('email')->filter()->values()->all();
        $fallback = config('mail.admin_address') ?? config('seo.support_email') ?? config('mail.from.address');

        if ($fallback) {
            $emails[] = $fallback;
        }

        return array_values(array_unique($emails));
    }

    /**
     * Уведомить администраторов: inbox + письмо через SMTP.
     *
     * @param string $subject тема обращения
     * @param string $message текст обращения
     * @param string $name имя отправителя
     * @param string $email email отправителя
     * @return void
     */
    public static function notifyAdmins(string $subject, string $message, string $name, string $email): void
    {
        $admins = User::where('is_admin', true)->orWhere('role', 'admin')->get();

        foreach ($admins as $admin) {
            \App\Services\UserNotifier::send($admin, new \App\Notifications\SupportRequestNotification($subject, $message, $name, $email));
        }

        foreach (static::adminEmails() as $to) {
            try {
                Mail::to($to)->send(new SupportRequestMail($subject, $message, $name, $email));
            } catch (\Throwable $e) {
                Log::warning('support mail failed', ['to' => $to, 'error' => $e->getMessage()]);
            }
        }
    }
}
