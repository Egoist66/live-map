<?php

namespace App\Http\Controllers;

use App\Models\Pin;
use App\Models\PinInvite;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Приглашения посмотреть пин вне зоны/страны.
 *
 * Только автор (или админ) может пригласить. Приглашённый видит
 * пин через show/index даже из другой страны/зоны.
 */
class PinInviteController extends Controller
{
    public function index(Request $request, Pin $pin)
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || (int) $pin->user_id === (int) $user->id, 403);
        $invites = PinInvite::where('pin_id', $pin->id)->with('invitee:id,name,avatar_path')->latest()->limit(100)->get();
        return response()->json($invites);
    }

    public function store(Request $request, Pin $pin)
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || (int) $pin->user_id === (int) $user->id, 403, 'Приглашать может только автор пина.');
        $data = $request->validate(['user_id' => 'required|exists:users,id']);
        $inviteeId = (int) $data['user_id'];
        abort_if($inviteeId === (int) $pin->user_id, 422, 'Нельзя пригласить самого себя.');
        $invitee = User::findOrFail($inviteeId);
        $reason = $user->messageBlockReason($invitee);
        if ($reason && !$user->isAdmin()) {
            abort(403, $reason);
        }
        $invite = PinInvite::updateOrCreate(
            ['pin_id' => $pin->id, 'invitee_id' => $inviteeId],
            ['inviter_id' => $user->id, 'status' => 'pending']
        );
        return response()->json($invite, 201);
    }

    public function destroy(Request $request, Pin $pin, PinInvite $invite)
    {
        $user = $request->user();
        abort_if((int) $invite->pin_id !== (int) $pin->id, 404);
        $isOwner = $user->isAdmin() || (int) $pin->user_id === (int) $user->id;
        $isInvitee = (int) $invite->invitee_id === (int) $user->id;
        abort_unless($isOwner || $isInvitee, 403);
        $invite->delete();
        return response()->json(['ok' => true]);
    }

    public function mine(Request $request)
    {
        $user = $request->user();
        $invites = PinInvite::where('invitee_id', $user->id)->with('pin')->latest()->limit(100)->get();
        $pins = $invites->map(fn($i) => $i->pin)->filter()->values();
        return response()->json($pins->map(fn($p) => $p->toPublicArray($user->id)));
    }
}
