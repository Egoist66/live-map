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
        if (!$isOwn && $auth && !$user->isDiscoverableBy($auth)) abort(404);
        if (!$isOwn && !$auth && $user->is_hidden_from_search) abort(404);
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
        $home = $user->publicHomeFor($auth);
        $base = $user->only(['id','name','gender','avatar_path','level','reputation_score','created_at','home_city','home_visibility','home_radius_km','bio','last_seen_at','is_invisible']);
        if ($isOwn) {
            $base['home_lat'] = $user->home_lat;
            $base['home_lng'] = $user->home_lng;
            $base['home_address'] = $user->home_address;
            $base['home_show_exact'] = (bool) $user->home_show_exact;
            $base['can_show_exact_home'] = $user->canShowExactHome();
        } elseif ($home) {
            $base['home_lat'] = $home['lat'];
            $base['home_lng'] = $home['lng'];
            $base['home_city'] = $home['city'];
            $base['home_address'] = $home['address'];
        } else {
            $base['home_lat'] = null;
            $base['home_lng'] = null;
            $base['home_city'] = $user->home_visibility === 'none' ? null : $user->home_city;
            $base['home_address'] = null;
        }
        if ($home) {
            $base['home_is_blurred'] = $home['is_blurred'];
            $base['home_blur_meters'] = $home['blur_meters'];
            $base['home_blur_label'] = $home['blur_label'];
        }
        return Inertia::render('Profile/Show', [
            'profileUser' => array_merge($base, ['avatar_url' => $user->avatar_url, 'last_seen_at' => $showLastSeen?->toISOString(), 'is_invisible' => $user->isInvisibleActive()]),
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
    public function edit(Request $request, ?string $identifier = null, ?string $tab = null): Response|RedirectResponse
    {
        $auth = $request->user();
        $tabIds = ['profile', 'billing', 'pins', 'privacy', 'appearance', 'security', 'support', 'app', 'admin'];
        if ($tab === null && $identifier !== null && in_array($identifier, $tabIds, true) && $identifier !== 'admin') {
            $tab = $identifier;
            $identifier = null;
        }
        $initialTab = in_array($tab, $tabIds, true) && ($tab !== 'admin' || $auth->isAdmin()) ? $tab : null;
        if ($identifier === null) {
            $profileUser = $auth;
            return Inertia::render('Profile/Edit', [
                'mustVerifyEmail' => $auth instanceof MustVerifyEmail,
                'status' => session('status'),
                'user' => $profileUser,
                'initialTab' => $initialTab,
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
            'initialTab' => $initialTab,
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $user->fill($request->validated());

        if ((bool) $user->home_show_exact && ! $user->canShowExactHome()) {
            $user->home_show_exact = false;
        }

        $meters = (int) ($user->default_blur_meters ?? 300);
        if ($meters > 1000 && !$user->canUseInvisible()) $meters = 1000;
        $user->default_blur_meters = max(0, min(5000, $meters));
        $user->default_location_precision = $user->default_blur_meters <= 0 ? 'exact' : 'custom';

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        $id = $user->isAdmin() ? 'admin' : (string) $user->id;
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
