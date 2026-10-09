<?php

namespace App\Http\Controllers;

use App\Mail\ReportReceived;
use App\Models\Report;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ReportController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'target_type' => 'required|in:pin,comment,user',
            'target_id' => 'required|integer',
            'reason' => 'required|in:spam,abuse,inappropriate,illegal,fake',
            'description' => 'nullable|string|max:1000',
        ]);
        if ($data['target_type'] === 'user') {
            abort_if((int) $data['target_id'] === (int) $request->user()->id, 422, 'Нельзя жаловаться на себя');
            abort_unless(\App\Models\User::whereKey($data['target_id'])->exists(), 404);
        }
        $exists = Report::where('reporter_id', $request->user()->id)
            ->where('target_type', $data['target_type'])
            ->where('target_id', $data['target_id'])
            ->where('status', 'pending')
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'Жалоба уже отправлена и ожидает проверки'], 409);
        }
        $data['reporter_id'] = $request->user()->id;
        $report = Report::create($data);
        if ($data['target_type'] === 'user') {
            try {
                $target = User::find((int) $data['target_id']);

                if ($target) {
                    \App\Services\TrustScoreService::penalizeReport($target);
                }
            } catch (\Throwable $e) {
                Log::warning('trust penalize failed', ['report' => $report->id, 'error' => $e->getMessage()]);
            }
        }
        if (Report::where('target_type', $data['target_type'])->where('target_id', $data['target_id'])->where('status', 'pending')->count() >= 3) {
            if ($data['target_type'] === 'pin') {
                $target = \App\Models\Pin::where('id', $data['target_id'])->first();
                if ($target && \App\Models\Pin::isSosCategory($target->category ?? null)) {
                    try {
                        \App\Services\SosService::cleanupConversationForPin($target, 'deleted');
                    } catch (\Throwable $e) {
                        Log::warning('sos report cleanup failed: '.$e->getMessage());
                    }
                }
                \App\Models\Pin::where('id', $data['target_id'])->update(['status' => 'archived']);
            }
        }
        static::notifyAdmins($report);
        return response()->json($report, 201);
    }

    /**
     * Список жалоб для таба «Модерация».
     *
     * Доступен модераторам и админам (админ — тоже модератор).
     *
     * @param Request $request запрос со статусом фильтра
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        abort_unless($request->user()->canModerate(), 403);
        $status = $request->query('status', 'pending');
        $q = Report::with(['reporter:id,name,avatar_path'])->latest();
        if (in_array($status, ['pending', 'resolved', 'dismissed'], true)) {
            $q->where('status', $status);
        }
        $reports = $q->paginate(15);
        $reports->getCollection()->transform(fn ($r) => array_merge($r->toArray(), [
            'target_title' => $r->targetTitle(),
            'reason_label' => Report::reasons()[$r->reason] ?? $r->reason,
        ]));
        return response()->json([
            'reports' => $reports,
            'pending_count' => Report::where('status', 'pending')->count(),
        ]);
    }

    /**
     * Принять или отклонить жалобу.
     *
     * Отклонённая жалоба на пользователя возвращает ему −1 репутации:
     * зря обвинили — скор чиним обратно.
     *
     * Доступен модераторам и админам.
     *
     * @param Request $request запрос с новым статусом
     * @param Report $report жалоба
     * @return \Illuminate\Http\JsonResponse
     */
    public function resolve(Request $request, Report $report)
    {
        abort_unless($request->user()->canModerate(), 403);
        $data = $request->validate(['status' => 'required|in:resolved,dismissed']);
        $report->update([
            'status' => $data['status'],
            'moderator_id' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        if ($data['status'] === 'dismissed' && $report->target_type === 'user') {
            try {
                $target = User::find((int) $report->target_id);

                if ($target) {
                    \App\Services\TrustScoreService::restoreReport($target);
                }
            } catch (\Throwable $e) {
                Log::warning('trust restore failed', ['report' => $report->id, 'error' => $e->getMessage()]);
            }
        }

        return response()->json($report);
    }

    public static function adminEmails(): array
    {
        $emails = User::where('is_admin', true)->orWhere('role', 'admin')->pluck('email')->filter()->values()->all();
        $fallback = config('mail.admin_address');
        if ($fallback) {
            $emails[] = $fallback;
        }
        return array_values(array_unique($emails));
    }

    public static function notifyAdmins(Report $report): void
    {
        $admins = User::where('is_admin', true)->orWhere('role', 'admin')->get();
        foreach ($admins as $admin) {
            \App\Services\UserNotifier::send($admin, new \App\Notifications\ReportCreatedNotification($report));
        }
        foreach (static::adminEmails() as $email) {
            try {
                Mail::to($email)->send(new ReportReceived($report));
            } catch (\Throwable $e) {
                Log::warning('report mail failed', ['report' => $report->id, 'email' => $email, 'error' => $e->getMessage()]);
            }
        }
    }
}
