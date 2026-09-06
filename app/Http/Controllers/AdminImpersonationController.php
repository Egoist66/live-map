<?php

namespace App\Http\Controllers;

use App\Models\AdminImpersonationLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class AdminImpersonationController extends Controller
{
    public function impersonate(Request $request, User $user)
    {
        $admin = $request->user();
        abort_unless($admin && $admin->isAdmin(), 403, 'Требуются права администратора');
        abort_if(session()->has('impersonator_id'), 422, 'Вы уже вошли под другим пользователем');

        $data = $request->validate([
            'reason' => 'required|string|min:10|max:500',
            'confirmed' => 'required|accepted',
        ]);

        abort_if($user->id === $admin->id, 422, 'Нельзя войти в свой же аккаунт');
        abort_if($user->isAdmin(), 403, 'Нельзя входить в аккаунт другого администратора');

        $log = AdminImpersonationLog::create([
            'admin_id' => $admin->id,
            'target_user_id' => $user->id,
            'reason' => trim($data['reason']),
            'ip' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 500),
            'started_at' => now(),
        ]);

        Log::warning('Admin impersonation started', [
            'log_id' => $log->id, 'admin_id' => $admin->id, 'admin_email' => $admin->email,
            'target_id' => $user->id, 'target_email' => $user->email,
            'reason' => $log->reason, 'ip' => $request->ip(),
        ]);

        session()->put('impersonator_id', $admin->id);
        session()->put('impersonation_log_id', $log->id);
        try {
            broadcast(new \App\Events\ImpersonationStarted($log));
        } catch (\Throwable $e) {
            Log::warning('impersonation broadcast failed', ['log_id' => $log->id, 'error' => $e->getMessage()]);
        }
        Auth::login($user);
        $request->session()->regenerate();

        return response()->json(['ok' => true, 'user_id' => $user->id]);
    }

    public function stop(Request $request)
    {
        $impersonatorId = session()->pull('impersonator_id');
        $logId = session()->pull('impersonation_log_id');
        abort_unless($impersonatorId, 422, 'Вы не находитесь в режиме просмотра чужого аккаунта');

        $admin = User::find($impersonatorId);
        abort_unless($admin && $admin->isAdmin(), 403, 'Исходный аккаунт администратора недоступен');

        if ($logId) {
            AdminImpersonationLog::where('id', $logId)->update(['ended_at' => now()]);
        }

        Log::warning('Admin impersonation stopped', [
            'log_id' => $logId, 'admin_id' => $admin->id, 'impersonated_id' => $request->user()?->id,
        ]);

        Auth::login($admin);
        $request->session()->regenerate();

        return response()->json(['ok' => true]);
    }

    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:100',
            'filter' => 'nullable|in:all,unread,read',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);
        $query = AdminImpersonationLog::with([
            'admin:id,name,email',
            'target:id,name,email',
        ])->latest('started_at');

        $filter = $data['filter'] ?? 'all';
        if ($filter === 'unread') $query->whereNull('seen_at');
        if ($filter === 'read') $query->whereNotNull('seen_at');

        if (! empty($data['q'])) {
            $term = trim($data['q']);
            $query->where(function ($w) use ($term) {
                $w->where('reason', 'like', "%$term%")
                    ->orWhereHas('target', fn ($t) => $t->where('name', 'like', "%$term%")->orWhere('email', 'like', "%$term%"))
                    ->orWhereHas('admin', fn ($a) => $a->where('name', 'like', "%$term%")->orWhere('email', 'like', "%$term%"));
            });
        }

        $paginator = $query->paginate((int) ($data['per_page'] ?? 20));

        return response()->json([
            'data' => collect($paginator->items())->map(fn ($l) => [
                'id' => $l->id,
                'reason' => $l->reason,
                'started_at' => $l->started_at?->toISOString(),
                'ended_at' => $l->ended_at?->toISOString(),
                'seen_at' => $l->seen_at?->toISOString(),
                'admin' => $l->admin ? $l->admin->only(['id', 'name', 'email']) : ['id' => $l->admin_id],
                'target' => $l->target ? $l->target->only(['id', 'name', 'email']) : ['id' => $l->target_user_id],
            ]),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
            'unread_count' => AdminImpersonationLog::whereNull('seen_at')->count(),
        ]);
    }

    public function myHistory(Request $request)
    {
        $logs = AdminImpersonationLog::where('target_user_id', $request->user()->id)
            ->latest('started_at')
            ->limit(50)
            ->get()
            ->map(fn ($l) => [
                'id' => $l->id,
                'reason' => $l->reason,
                'started_at' => $l->started_at?->toISOString(),
                'ended_at' => $l->ended_at?->toISOString(),
                'seen_at' => $l->seen_at?->toISOString(),
            ]);
        return response()->json([
            'data' => $logs,
            'unread' => AdminImpersonationLog::where('target_user_id', $request->user()->id)->whereNull('seen_at')->count(),
        ]);
    }

    public function markSeen(Request $request)
    {
        AdminImpersonationLog::where('target_user_id', $request->user()->id)->whereNull('seen_at')->update(['seen_at' => now()]);
        return response()->json(['ok' => true]);
    }
}
