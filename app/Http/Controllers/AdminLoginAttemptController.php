<?php

namespace App\Http\Controllers;

use App\Models\LoginAttempt;
use Illuminate\Http\Request;

class AdminLoginAttemptController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'q' => 'nullable|string|max:100',
            'successful' => 'nullable|in:all,failed,success',
            'per_page' => 'nullable|integer|min:5|max:100',
        ]);
        $q = trim($data['q'] ?? '');
        $mode = $data['successful'] ?? 'failed';
        $query = LoginAttempt::with('user:id,name,email')->latest('id');
        if ($mode === 'failed') $query->where('successful', false);
        elseif ($mode === 'success') $query->where('successful', true);
        if (strlen($q) >= 1) {
            $query->where(fn ($w) => $w->where('email', 'like', "%$q%")->orWhere('ip', 'like', "%$q%")->orWhere('country', 'like', "%$q%"));
        }
        $list = $query->paginate((int) ($data['per_page'] ?? 20));
        $list->getCollection()->transform(fn ($a) => [
            'id' => $a->id,
            'email' => $a->email,
            'user' => $a->user ? ['id' => $a->user->id, 'name' => $a->user->name, 'email' => $a->user->email, 'banned_at' => $a->user->banned_at?->toISOString(), 'banned_reason' => $a->user->banned_reason] : null,
            'ip' => $a->ip,
            'country' => $a->country,
            'country_code' => $a->country_code,
            'city' => $a->city,
            'user_agent' => $a->user_agent,
            'successful' => (bool) $a->successful,
            'created_at' => $a->created_at?->toISOString(),
        ]);
        $failedToday = LoginAttempt::where('successful', false)->where('created_at', '>=', now()->subDay())->count();
        $bannedTotal = \App\Models\User::whereNotNull('banned_at')->count();
        return response()->json(array_merge($list->toArray(), ['stats' => ['failed_today' => $failedToday, 'banned_total' => $bannedTotal]]));
    }
}
