<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
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
