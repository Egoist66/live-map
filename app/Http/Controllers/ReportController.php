<?php

namespace App\Http\Controllers;

use App\Events\ReportCreated;
use App\Mail\ReportReceived;
use App\Models\Report;
use App\Models\User;
use App\Services\WebPushService;
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
        if (Report::where('target_type', $data['target_type'])->where('target_id', $data['target_id'])->where('status', 'pending')->count() >= 3) {
            if ($data['target_type'] === 'pin') \App\Models\Pin::where('id', $data['target_id'])->update(['status' => 'archived']);
        }
        static::notifyAdmins($report);
        return response()->json($report, 201);
    }

    public function index(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);
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

    public function resolve(Request $request, Report $report)
    {
        abort_unless($request->user()->isAdmin(), 403);
        $data = $request->validate(['status' => 'required|in:resolved,dismissed']);
        $report->update([
            'status' => $data['status'],
            'moderator_id' => $request->user()->id,
            'resolved_at' => now(),
        ]);
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
        $adminIds = User::where('is_admin', true)->orWhere('role', 'admin')->pluck('id')->map(fn ($v) => (int) $v)->values()->all();
        if (! empty($adminIds)) {
            try {
                broadcast(new ReportCreated($report, $adminIds));
            } catch (\Throwable $e) {
                Log::warning('report broadcast failed', ['report' => $report->id, 'error' => $e->getMessage()]);
            }
            try {
                $push = app(WebPushService::class);
                foreach (User::whereIn('id', $adminIds)->get() as $admin) {
                    $push->sendReport($admin, $report);
                }
            } catch (\Throwable $e) {
                Log::warning('report webpush failed', ['report' => $report->id, 'error' => $e->getMessage()]);
            }
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
