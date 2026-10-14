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

        return response()->json(['ok' => true, 'ticket_id' => $ticket->id], 201);
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
        $query = SupportTicket::with(['user:id,name,avatar_path,profile_slug', 'replier:id,name'])->latest();

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
     * Письмо уходит строго на email из тикета, одно, без копий.
     * Повторный ответ на закрытый тикет переоткрывает его как отвеченный.
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

        try {
            Mail::to($ticket->email)->send(new SupportReplyMail(
                $ticket->id,
                $ticket->subject,
                $answer,
                $ticket->name,
                $ticket->message,
            ));
        } catch (\Throwable $e) {
            Log::warning('support reply mail failed', ['ticket' => $ticket->id, 'error' => $e->getMessage()]);

            return response()->json(['message' => 'Не получилось отправить письмо'], 502);
        }

        $ticket->update([
            'admin_reply' => $answer,
            'status' => SupportTicket::STATUS_ANSWERED,
            'replied_by' => $request->user()->id,
            'replied_at' => now(),
        ]);

        $author = $ticket->user()->first() ?? User::where('email', $ticket->email)->first();

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

        return response()->json($ticket->refresh()->load(['user:id,name,avatar_path,profile_slug', 'replier:id,name']));
    }

    /**
     * Отклонить обращение без ответа или с короткой причиной.
     *
     * Причина (если есть) уходит пользователю тем же письмом-ответом,
     * пустое отклонение писем не шлёт — только закрывает тикет.
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

        if ($reason !== '') {
            try {
                Mail::to($ticket->email)->send(new SupportReplyMail(
                    $ticket->id,
                    $ticket->subject,
                    $reason,
                    $ticket->name,
                    $ticket->message,
                ));
            } catch (\Throwable $e) {
                Log::warning('support reject mail failed', ['ticket' => $ticket->id, 'error' => $e->getMessage()]);

                return response()->json(['message' => 'Не получилось отправить письмо'], 502);
            }
        }

        $ticket->update([
            'admin_reply' => $reason !== '' ? $reason : $ticket->admin_reply,
            'status' => SupportTicket::STATUS_REJECTED,
            'replied_by' => $request->user()->id,
            'replied_at' => now(),
        ]);

        return response()->json($ticket->refresh()->load(['user:id,name,avatar_path,profile_slug', 'replier:id,name']));
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
        $emails = User::where('is_admin', true)->orWhere('role', 'admin')->pluck('email')->all();
        $fallback = config('mail.admin_address') ?? config('seo.support_email') ?? config('mail.from.address');

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
