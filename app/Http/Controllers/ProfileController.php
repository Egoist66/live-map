<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function publicShow(Request $request, \App\Models\User $user): Response
    {
        $auth = $request->user();
        $isOwn = $auth && $auth->id === $user->id;
        $canMessage = $auth ? $auth->canMessageUser($user) : false;
        $reason = $auth ? $auth->messageBlockReason($user) : null;
        $friendship = null;
        $isFriend = false;
        $isPending = false;
        $isBlocked = false;
        $isBlockedBy = false;
        if ($auth && !$isOwn) {
            $friendship = \App\Models\Friendship::where(function($q) use ($auth,$user){
                $q->where('requester_id',$auth->id)->where('addressee_id',$user->id)
                  ->orWhere(fn($x)=>$x->where('requester_id',$user->id)->where('addressee_id',$auth->id));
            })->first();
            $isFriend = $friendship?->status==='accepted';
            $isPending = $friendship?->status==='pending';
            $isBlocked = \App\Models\UserBlock::where('blocker_id',$auth->id)->where('blocked_id',$user->id)->exists();
            $isBlockedBy = \App\Models\UserBlock::where('blocker_id',$user->id)->where('blocked_id',$auth->id)->exists();
        }
        $showLastSeen = $user->last_seen_at;
        if ($user->isInvisibleActive() && !$isOwn && !($auth && $auth->isAdmin())) {
            $showLastSeen = null;
        }
        return Inertia::render('Profile/Show', [
            'profileUser' => array_merge($user->only(['id','name','gender','avatar_path','level','reputation_score','created_at','home_lat','home_lng','home_radius_km','bio','last_seen_at','is_invisible']), ['avatar_url' => $user->avatar_url, 'last_seen_at' => $showLastSeen?->toISOString(), 'is_invisible' => $user->isInvisibleActive()]),
            'isOwn' => $isOwn,
            'friendship' => $friendship,
            'isFriend' => $isFriend,
            'isPending' => $isPending,
            'isBlocked' => $isBlocked,
            'isBlockedBy' => $isBlockedBy,
            'canMessage' => $canMessage,
            'canMessageReason' => $reason,
        ]);
    }

    public function toggleInvisible(Request $request)
    {
        $user = $request->user();
        abort_unless($user->canUseInvisible(), 403, 'Недоступно для вашего тарифа');
        $request->validate(['is_invisible' => 'required|boolean']);
        $user->forceFill(['is_invisible' => $request->boolean('is_invisible')])->save();
        return response()->json(['is_invisible' => $user->isInvisibleActive(), 'can_use_invisible' => $user->canUseInvisible()]);
    }

    public function dashboard(Request $request, ?string $identifier = null): Response|RedirectResponse
    {
        $auth = $request->user();
        if ($identifier === null) {
            $profileUser = $auth;
            return Inertia::render('Dashboard', [
                'user' => $profileUser,
                'isOwn' => true,
            ]);
        }
        if ($identifier === 'admin') {
            abort_unless($auth->isAdmin(), 403, 'Только админ');
            $profileUser = $auth;
        } elseif (is_numeric($identifier)) {
            $profileUser = \App\Models\User::findOrFail((int) $identifier);
            if ($profileUser->id !== $auth->id && !$auth->isAdmin()) {
                return redirect()->route('users.show', $profileUser->id);
            }
        } else {
            abort(404);
        }
        return Inertia::render('Dashboard', [
            'user' => $profileUser,
            'isOwn' => $profileUser->id === $auth->id,
        ]);
    }

    /**
     * Display the user's profile form.
     */
    public function edit(Request $request, ?string $identifier = null): Response|RedirectResponse
    {
        $auth = $request->user();
        if ($identifier === null) {
            $profileUser = $auth;
            return Inertia::render('Profile/Edit', [
                'mustVerifyEmail' => $auth instanceof MustVerifyEmail,
                'status' => session('status'),
                'user' => $profileUser,
            ]);
        }
        if ($identifier === 'admin') {
            abort_unless($auth->isAdmin(), 403, 'Только админ');
            $profileUser = $auth;
        } elseif (is_numeric($identifier)) {
            $profileUser = \App\Models\User::findOrFail((int) $identifier);
            if ($profileUser->id !== $auth->id && !$auth->isAdmin()) abort(403, 'Чужой профиль');
        } else {
            abort(404);
        }
        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $auth instanceof MustVerifyEmail,
            'status' => session('status'),
            'user' => $profileUser,
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $request->user()->fill($request->validated());

        if ($request->user()->isDirty('email')) {
            $request->user()->email_verified_at = null;
        }

        $request->user()->save();

        $id = $request->user()->isAdmin() ? 'admin' : (string) $request->user()->id;
        return Redirect::route('profile.edit', ['identifier' => $id]);
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
