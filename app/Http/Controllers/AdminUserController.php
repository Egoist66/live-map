<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:100',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);
        $q = trim($data['q'] ?? '');
        $query = User::query()->orderByDesc('last_seen_at');
        if (strlen($q) >= 1) {
            $query->where(fn ($w) => $w->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%"));
        }
        $threshold = now()->subMinutes(\App\Services\MonitoringService::ONLINE_MINUTES);
        $users = $query->select('id', 'name', 'email', 'avatar_path', 'role', 'is_admin', 'is_hidden_from_search', 'plan', 'last_seen_at', 'is_invisible', 'created_at', 'banned_at', 'banned_reason')
            ->paginate((int) ($data['per_page'] ?? 20));
        $users->getCollection()->transform(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'avatar_path' => $u->avatar_path,
            'avatar_url' => $u->avatar_url,
            'role' => $u->role,
            'is_admin' => $u->isAdmin(),
            'is_hidden_from_search' => (bool) $u->is_hidden_from_search,
            'plan' => $u->plan,
            'is_online' => $u->last_seen_at && $u->last_seen_at->gte($threshold),
            'last_seen_at' => $u->last_seen_at?->toISOString(),
            'is_invisible' => (bool) $u->is_invisible,
            'banned_at' => $u->banned_at?->toISOString(),
            'banned_reason' => $u->banned_reason,
            'created_at' => $u->created_at?->toISOString(),
        ]);
        return response()->json($users);
    }

    /**
     * Обновить план/роль пользователя.
     *
     * Свою роль менять можно, но снятие admin с себя запрещено,
     * если это последний администратор в системе.
     *
     * @param Request $request
     * @param User $user
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'plan' => 'nullable|in:free,pro,business',
            'plan_expires_at' => 'nullable|date|after:now',
            'role' => 'nullable|in:user,moderator,admin',
        ]);
        $isSelf = $user->id === $request->user()->id;
        $demotesSelfFromAdmin = $isSelf
            && isset($data['role'])
            && $request->user()->isAdmin()
            && $data['role'] !== 'admin';
        if ($demotesSelfFromAdmin) {
            $otherAdmins = User::query()
                ->where('id', '!=', $user->id)
                ->where(fn ($w) => $w->where('is_admin', true)->orWhere('role', 'admin'))
                ->count();
            abort_if($otherAdmins === 0, 422, 'Нельзя снять роль последнего администратора');
        }
        if (isset($data['plan'])) {
            $user->plan = $data['plan'];
            $user->plan_expires_at = $data['plan'] === 'free'
                ? null
                : (isset($data['plan_expires_at']) ? \Carbon\Carbon::parse($data['plan_expires_at']) : $user->plan_expires_at);
        } elseif (isset($data['plan_expires_at'])) {
            $user->plan_expires_at = \Carbon\Carbon::parse($data['plan_expires_at']);
        }
        if (isset($data['role'])) {
            $user->role = $data['role'];
            $user->is_admin = $data['role'] === 'admin';
        }
        $user->save();
        return response()->json(['id' => $user->id, 'plan' => $user->plan, 'effective_plan' => $user->effectivePlan(), 'plan_expires_at' => $user->plan_expires_at?->toISOString(), 'role' => $user->role, 'is_admin' => $user->isAdmin()]);
    }

    public function search(Request $request)
    {
        $q = trim($request->input('q', ''));
        abort_if(strlen($q) < 2, 422, 'Минимум 2 символа');
        $users = User::where(fn($qq) => $qq->where('name', 'like', "%$q%")->orWhere('email', 'like', "%$q%"))
            ->select('id', 'name', 'email', 'avatar_path', 'role', 'is_admin', 'is_hidden_from_search', 'plan')
            ->limit(20)->get()
            ->map(fn($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'avatar_path' => $u->avatar_path,
                'avatar_url' => $u->avatar_url,
                'role' => $u->role,
                'is_admin' => $u->isAdmin(),
                'is_hidden_from_search' => (bool) $u->is_hidden_from_search,
                'plan' => $u->plan,
            ]);
        return response()->json($users);
    }

    public function updateVisibility(Request $request, User $user)
    {
        $data = $request->validate(['is_hidden_from_search' => 'required|boolean']);
        $user->forceFill(['is_hidden_from_search' => $data['is_hidden_from_search']])->save();
        return response()->json([
            'id' => $user->id,
            'is_hidden_from_search' => (bool) $user->is_hidden_from_search,
        ]);
    }

    public function ban(Request $request, User $user)
    {
        $data = $request->validate(['reason' => 'nullable|string|max:255']);
        abort_if($user->id === $request->user()->id, 422, 'Нельзя заблокировать себя');
        abort_if($user->isAdmin(), 403, 'Нельзя заблокировать администратора');
        $user->forceFill([
            'banned_at' => now(),
            'banned_reason' => $data['reason'] ?? 'Заблокирован администратором',
        ])->save();
        return response()->json(['id' => $user->id, 'banned_at' => $user->banned_at?->toISOString(), 'banned_reason' => $user->banned_reason]);
    }

    public function unban(Request $request, User $user)
    {
        $user->forceFill(['banned_at' => null, 'banned_reason' => null])->save();
        return response()->json(['id' => $user->id, 'banned_at' => null, 'banned_reason' => null]);
    }

    public function destroy(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'Нельзя удалить себя здесь — используйте удаление в Безопасности');
        abort_if($user->isAdmin() && !$request->user()->is_admin, 403, 'Нельзя удалить администратора');
        $user->delete();
        return response()->json(['ok' => true]);
    }
}
