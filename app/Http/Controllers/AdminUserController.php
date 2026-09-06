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
        $users = $query->select('id', 'name', 'email', 'avatar_path', 'role', 'is_admin', 'is_hidden_from_search', 'plan', 'last_seen_at', 'is_invisible', 'created_at')
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
            'created_at' => $u->created_at?->toISOString(),
        ]);
        return response()->json($users);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'plan' => 'nullable|in:free,pro,business',
            'role' => 'nullable|in:user,moderator,admin',
        ]);
        abort_if($user->id === $request->user()->id && isset($data['role']), 422, 'Нельзя менять свою роль здесь');
        if (isset($data['plan'])) $user->plan = $data['plan'];
        if (isset($data['role'])) {
            $user->role = $data['role'];
            $user->is_admin = $data['role'] === 'admin';
        }
        $user->save();
        return response()->json(['id' => $user->id, 'plan' => $user->plan, 'role' => $user->role, 'is_admin' => $user->isAdmin()]);
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

    public function destroy(Request $request, User $user)
    {
        abort_if($user->id === $request->user()->id, 422, 'Нельзя удалить себя здесь — используйте удаление в Безопасности');
        abort_if($user->isAdmin() && !$request->user()->is_admin, 403, 'Нельзя удалить администратора');
        $user->delete();
        return response()->json(['ok' => true]);
    }
}
