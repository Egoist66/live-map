<?php

namespace App\Http\Controllers;

use App\Mail\SupportReplyMail;
use App\Mail\SupportRequestMail;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Обращения в поддержку: форма пользователя + разбор в админке.
 *
 * Пользователь пишет тему + сообщение из настроек — тикет падает в базу
 * (админка «Обращения»), админы получают inbox-уведомление и одно письмо
 * на почту. Админ отвечает (письмо пользователю + inbox) или отклоняет.
 */
class SupportController extends Controller
{
    /**
     * Принять обращение в поддержку от залогиненного пользователя.
     *
     * Имя и email берём из аккаунта (для ответа), тему и текст —
     * из формы. Повтор той же темы с тем же текстом в течение 10 минут
     * считается дублем (двойной клик, ретрай) — возвращаем 409.
     * Спам режется троттлом support (6/мин на юзера).
     *
     * @param Request $request тема + сообщение
     * @return JsonResponse ok + id тикета
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

        if ($subject === '' || mb_strlen($subject) < 3) {
            return response()->json(['message' => 'Укажи тему чуть подробнее (минимум 3 символа).'], 422);
        }

        if ($message === '' || mb_strlen($message) < 10) {
            return response()->json(['message' => 'Опиши проблему чуть подробнее (минимум 10 символов).'], 422);
        }

        $dupe = SupportTicket::where('user_id', $me->id)
            ->where('subject', $subject)
            ->where('message', $message)
            ->where('created_at', '>', now()->subMinutes(10))
            ->first();

        if ($dupe) {
            return response()->json(['message' => 'Такое обращение уже отправлено', 'ticket_id' => $dupe->id], 409);
        }

        $ticket = SupportTicket::create([
            'user_id' => $me->id,
            'name' => $name,
            'email' => $email,
            'subject' => $subject,
            'message' => $message,
            'status' => SupportTicket::STATUS_NEW,
        ]);

        static::notifyAdmins($ticket);

        $emailVerified = $me->hasVerifiedEmail();

        return response()->json([
            'ok' => true,
            'ticket_id' => $ticket->id,
            'email_verified' => $emailVerified,
            'inbox_only' => ! $emailVerified,
        ], 201);
    }

    /**
     * Список тикетов для админки «Обращения».
     *
     * Доступен модераторам и админам (админ — тоже модератор).
     *
     * @param Request $request запрос с фильтром status
     * @return JsonResponse
     */
    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless($request->user()->canModerate(), 403);

        $status = (string) $request->query('status', SupportTicket::STATUS_NEW);
        $query = SupportTicket::with(['user:id,name,avatar_path,profile_slug,email_verified_at', 'replier:id,name'])->latest();

        if (in_array($status, SupportTicket::STATUSES, true)) {
            $query->where('status', $status);
        }

        $tickets = $query->paginate(15);

        return response()->json([
            'tickets' => $tickets,
            'new_count' => SupportTicket::where('status', SupportTicket::STATUS_NEW)->count(),
        ]);
    }

    /**
     * Ответить на обращение: письмо пользователю + inbox + статус.
     *
     * Письмо уходит строго на email из тикета и только когда почта
     * автора подтверждена (hasVerifiedEmail). Без подтверждения —
     * только inbox в приложение (колокольчик + realtime + push),
     * чтобы ответ не потерялся и не улетел на чужой/битый ящик.
     * Повторный ответ на закрытый тикет переоткрывает его как отвеченный.
     * Пустой ответ (только пробелы) запрещён — 422.
     *
     * Доступен модераторам и админам.
     *
     * @param Request $request запрос с текстом ответа
     * @param SupportTicket $ticket тикет
     * @return JsonResponse
     */
    public function reply(Request $request, SupportTicket $ticket): JsonResponse
    {
        abort_unless($request->user()->canModerate(), 403);

        $data = $request->validate([
            'message' => 'required|string|min:2|max:2000',
        ]);

        $answer = trim($data['message']);

        if ($answer === '' || mb_strlen($answer) < 2) {
            return response()->json(['message' => 'Ответ не может быть пустым (минимум 2 символа).'], 422);
        }

        $author = $ticket->user()->first() ?? User::where('email', $ticket->email)->first();
        $emailVerified = $author ? $author->hasVerifiedEmail() : true;
        $mailed = false;

        if ($emailVerified) {
            try {
                Mail::to($ticket->email)->send(new SupportReplyMail(
                    $ticket->id,
                    $ticket->subject,
                    $answer,
                    $ticket->name,
                    $ticket->message,
                ));

                $mailed = true;
            } catch (\Throwable $e) {
                Log::warning('support reply mail failed', ['ticket' => $ticket->id, 'error' => $e->getMessage()]);

                return response()->json(['message' => 'Не получилось отправить письмо'], 502);
            }
        } else {
            Log::info('support reply mail skipped (unverified)', ['ticket' => $ticket->id]);
        }

        $ticket->update([
            'admin_reply' => $answer,
            'status' => SupportTicket::STATUS_ANSWERED,
            'replied_by' => $request->user()->id,
            'replied_at' => now(),
        ]);

        if ($author) {
            try {
                \App\Services\UserNotifier::send($author, new \App\Notifications\SupportAnsweredNotification(
                    $ticket->id,
                    $ticket->subject,
                    $answer,
                ));
            } catch (\Throwable $e) {
                Log::warning('support answer notify failed', ['ticket' => $ticket->id, 'error' => $e->getMessage()]);
            }
        }

        $fresh = $ticket->refresh()->load(['user:id,name,avatar_path,profile_slug', 'replier:id,name']);

        return response()->json(array_merge($fresh->toArray(), [
            'mailed' => $mailed,
            'email_verified' => $emailVerified,
            'inbox_only' => ! $mailed,
        ]));
    }

    /**
     * Отклонить обращение без ответа или с короткой причиной.
     *
     * Причина (если есть) уходит письмом только на подтверждённую
     * почту автора; без подтверждения — только inbox в приложение.
     * Пустое отклонение писем не шлёт — только закрывает тикет,
     * но inbox-строку всё равно создаёт, чтобы человек увидел итог
     * в колокольчике (realtime + push через UserNotifier).
     *
     * Доступен модераторам и админам.
     *
     * @param Request $request запрос с необязательной причиной
     * @param SupportTicket $ticket тикет
     * @return JsonResponse
     */
    public function reject(Request $request, SupportTicket $ticket): JsonResponse
    {
        abort_unless($request->user()->canModerate(), 403);

        $data = $request->validate([
            'reason' => 'nullable|string|max:2000',
        ]);

        $reason = trim((string) ($data['reason'] ?? ''));
        $author = $ticket->user()->first() ?? User::where('email', $ticket->email)->first();
        $emailVerified = $author ? $author->hasVerifiedEmail() : true;
        $mailed = false;

        if ($reason !== '') {
            if ($emailVerified) {
                try {
                    Mail::to($ticket->email)->send(new SupportReplyMail(
                        $ticket->id,
                        $ticket->subject,
                        $reason,
                        $ticket->name,
                        $ticket->message,
                    ));

                    $mailed = true;
                } catch (\Throwable $e) {
                    Log::warning('support reject mail failed', ['ticket' => $ticket->id, 'error' => $e->getMessage()]);

                    return response()->json(['message' => 'Не получилось отправить письмо'], 502);
                }
            } else {
                Log::info('support reject mail skipped (unverified)', ['ticket' => $ticket->id]);
            }
        }

        $ticket->update([
            'admin_reply' => $reason !== '' ? $reason : $ticket->admin_reply,
            'status' => SupportTicket::STATUS_REJECTED,
            'replied_by' => $request->user()->id,
            'replied_at' => now(),
        ]);

        if ($author) {
            try {
                \App\Services\UserNotifier::send($author, new \App\Notifications\SupportAnsweredNotification(
                    $ticket->id,
                    $ticket->subject,
                    $reason !== '' ? $reason : 'Обращение отклонено модерацией.',
                ));
            } catch (\Throwable $e) {
                Log::warning('support reject notify failed', ['ticket' => $ticket->id, 'error' => $e->getMessage()]);
            }
        }

        $fresh = $ticket->refresh()->load(['user:id,name,avatar_path,profile_slug', 'replier:id,name']);

        return response()->json(array_merge($fresh->toArray(), [
            'mailed' => $mailed,
            'email_verified' => $emailVerified,
            'inbox_only' => $reason !== '' && ! $mailed,
        ]));
    }

    /**
     * Адреса администраторов для писем (как в жалобах и сотрудничестве).
     *
     * Нормализуем регистр и формат, убираем дубли: один ящик —
     * одно письмо. Публичный — переиспользуется консольной командой
     * service:email для показа, куда реально уходят письма поддержки.
     *
     * @return string[]
     */
    public static function adminEmails(): array
    {
        return \App\Services\AdminNotifier::emails();
    }

    /**
     * Уведомить администраторов: inbox каждому + письма на ящики.
     *
     * Письмо одно на ящик (список уже без дублей), с номером тикета
     * в теме — в почте видно, что это то же обращение, а не новое.
     *
     * @param SupportTicket $ticket тикет
     * @return void
     */
    public static function notifyAdmins(SupportTicket $ticket): void
    {
        $admins = User::where('is_admin', true)->orWhere('role', 'admin')->get();

        foreach ($admins as $admin) {
            \App\Services\UserNotifier::send($admin, new \App\Notifications\SupportRequestNotification(
                $ticket->id,
                $ticket->subject,
                $ticket->message,
                $ticket->name,
                $ticket->email,
            ));
        }

        foreach (static::adminEmails() as $to) {
            try {
                Mail::to($to)->send(new SupportRequestMail(
                    $ticket->subject,
                    $ticket->message,
                    $ticket->name,
                    $ticket->email,
                    $ticket->id,
                ));
            } catch (\Throwable $e) {
                Log::warning('support mail failed', ['ticket' => $ticket->id, 'to' => $to, 'error' => $e->getMessage()]);
            }
        }
    }
}
