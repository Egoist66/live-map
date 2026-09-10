<?php

namespace App\Http\Controllers;

use App\Events\FriendshipUpdated;
use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\Request;

class FriendshipController extends Controller
{
    public function index(Request $request)
    {
        $u = $request->user();
        $friends = Friendship::where('status','accepted')
            ->where(fn($q)=>$q->where('requester_id',$u->id)->orWhere('addressee_id',$u->id))
            ->with(['requester:id,name,avatar_path,last_seen_at,is_invisible,plan,role,is_admin','addressee:id,name,avatar_path,last_seen_at,is_invisible,plan,role,is_admin'])
            ->get()->map(function($f) use ($u){
                $other = $f->requester_id===$u->id ? $f->addressee : $f->requester;
                $hiddenOnline = $other && $other->isInvisibleActive() && !$u->isAdmin();
                if ($other && $hiddenOnline) $other->setAttribute('last_seen_at', null);
                if ($other) $other->setAttribute('is_invisible', $other->isInvisibleActive());
                if ($other) $other->setAttribute('is_online', $hiddenOnline ? false : \App\Services\MonitoringService::isOnline($other->last_seen_at));
                return [
                    'id'=>$f->id,
                    'status'=>$f->status,
                    'is_hidden'=>$f->isHiddenFor($u->id),
                    'other'=>$other,
                    'created_at'=>$f->created_at,
                ];
            });
        $pendingIn = Friendship::where('status','pending')->where('addressee_id',$u->id)->with('requester:id,name,avatar_path,last_seen_at,is_invisible,plan,role,is_admin')->get()->each(function($f) use ($u) {
            if ($f->requester && $f->requester->isInvisibleActive() && !$u->isAdmin()) $f->requester->setAttribute('last_seen_at', null);
            $f->requester?->setAttribute('is_invisible', $f->requester->isInvisibleActive());
        });
        $pendingOut = Friendship::where('status','pending')->where('requester_id',$u->id)->with('addressee:id,name,avatar_path')->get();
        $limit = $u->hiddenFriendsLimit();
        return response()->json([
            'friends'=>$friends,
            'pending_in'=>$pendingIn,
            'pending_out'=>$pendingOut,
            'hidden_limit'=>$limit,
            'hidden_count'=>$u->hiddenFriendsCount(),
            'hidden_unlimited'=>$limit===null,
        ]);
    }

    public function toggleHidden(Request $request, Friendship $friendship)
    {
        $u = $request->user();
        abort_unless(in_array($u->id, [$friendship->requester_id, $friendship->addressee_id]), 403);
        abort_unless($friendship->status === 'accepted', 422, 'Только принятых друзей можно скрывать');
        $request->validate(['is_hidden' => 'sometimes|boolean']);
        $hidden = $request->has('is_hidden') ? $request->boolean('is_hidden') : !$friendship->isHiddenFor($u->id);
        if ($hidden && !$friendship->isHiddenFor($u->id) && !$u->canHideFriend($friendship->id)) {
            $limit = $u->hiddenFriendsLimit();
            return response()->json(['message' => "Лимит скрытых друзей исчерпан ({$limit}). Обновите тариф."], 422);
        }
        $friendship->setHiddenFor($u->id, $hidden);
        $friendship->save();
        return response()->json([
            'id' => $friendship->id,
            'is_hidden' => $friendship->isHiddenFor($u->id),
            'hidden_count' => $u->hiddenFriendsCount(),
            'hidden_limit' => $u->hiddenFriendsLimit(),
            'hidden_unlimited' => $u->hiddenFriendsLimit() === null,
        ]);
    }

    public function publicList(Request $request, User $user)
    {
        $viewer = $request->user();
        $isOwn = $viewer && $viewer->id === $user->id;
        $canSeeHidden = $isOwn || ($viewer && $viewer->isAdmin());
        $query = Friendship::where('status', 'accepted')
            ->where(fn($q) => $q->where('requester_id', $user->id)->orWhere('addressee_id', $user->id))
            ->with(['requester:id,name,avatar_path,last_seen_at,is_invisible', 'addressee:id,name,avatar_path,last_seen_at,is_invisible']);
        if (!$canSeeHidden) {
            $query->where(function ($q) use ($user) {
                $q->where(function ($x) use ($user) { $x->where('requester_id', $user->id)->where('hidden_by_requester', false); })
                  ->orWhere(function ($x) use ($user) { $x->where('addressee_id', $user->id)->where('hidden_by_addressee', false); });
            });
        }
        $friends = $query->get()->map(function ($f) use ($user, $isOwn, $canSeeHidden, $viewer) {
            $other = $f->requester_id === $user->id ? $f->addressee : $f->requester;
            if ($other) {
                $hiddenOnline = $other->isInvisibleActive() && (! $viewer || ! $viewer->isAdmin());
                $other->setAttribute('is_online', $hiddenOnline ? false : \App\Services\MonitoringService::isOnline($other->last_seen_at));
                $other->setAttribute('is_invisible', $other->isInvisibleActive());
                if ($hiddenOnline) $other->setAttribute('last_seen_at', null);
            }
            return [
                'id' => $f->id,
                'other' => $other,
                'is_hidden' => $canSeeHidden ? $f->isHiddenFor($user->id) : false,
            ];
        })->reject(function ($row) use ($viewer) {
            if (!$row['other'] || (int) $row['other']->id !== User::GHOST_USER_ID) return false;
            return !User::isGhostSeer($viewer);
        })->values();
        return response()->json(['friends' => $friends, 'is_own' => $isOwn]);
    }

    public function store(Request $request)
    {
        $request->validate(['user_id'=>'required|exists:users,id']);
        $me = $request->user();
        $otherId = (int)$request->input('user_id');
        abort_if($me->id===$otherId,422,'Нельзя добавить себя');
        $target = User::find($otherId);
        abort_if(!$target || !$target->isDiscoverableBy($me), 404);
        abort_if(UserBlock::where('blocker_id',$otherId)->where('blocked_id',$me->id)->exists(),403,'Пользователь заблокировал вас');
        abort_if(UserBlock::where('blocker_id',$me->id)->where('blocked_id',$otherId)->exists(),403,'Вы заблокировали пользователя');
        $exists = Friendship::where(function($q) use ($me,$otherId){
            $q->where('requester_id',$me->id)->where('addressee_id',$otherId)
              ->orWhere(fn($x)=>$x->where('requester_id',$otherId)->where('addressee_id',$me->id));
        })->first();
        if ($exists) {
            if ($exists->status==='accepted') return response()->json(['message'=>'Уже друзья'],422);
            if ($exists->status==='pending') return response()->json(['message'=>'Заявка уже отправлена'],422);
            if ($exists->status==='declined') { $exists->update(['requester_id'=>$me->id,'addressee_id'=>$otherId,'status'=>'pending']); try{ broadcast(new FriendshipUpdated($exists))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); } $this->pushFriendRequest($otherId, $me); return response()->json($exists,201); }
        }
        $f = Friendship::create(['requester_id'=>$me->id,'addressee_id'=>$otherId,'status'=>'pending']);
        try{ broadcast(new FriendshipUpdated($f->load(['requester','addressee'])))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        $this->pushFriendRequest($otherId, $me);
        return response()->json($f,201);
    }

    public function accept(Request $request, Friendship $friendship)
    {
        abort_unless($friendship->addressee_id===$request->user()->id,403);
        abort_unless($friendship->status==='pending',422);
        $friendship->update(['status'=>'accepted']);
        try{ broadcast(new FriendshipUpdated($friendship->load(['requester','addressee'])))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        try {
            $push = app(\App\Services\WebPushService::class);
            if ($push->isConfigured()) {
                $requester = User::select('id', 'name', 'avatar_path')->find($friendship->requester_id);
                $addresseeModel = User::select('id', 'name', 'avatar_path')->find($request->user()->id);
                if ($requester) $push->sendFriendAccepted($requester, $addresseeModel ?? $request->user());
            }
        } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('friend webpush failed: '.$e->getMessage()); }
        return response()->json($friendship);
    }

    public function decline(Request $request, Friendship $friendship)
    {
        abort_unless($friendship->addressee_id===$request->user()->id,403);
        abort_unless($friendship->status==='pending',422);
        $friendship->update(['status'=>'declined']);
        try{ broadcast(new FriendshipUpdated($friendship))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json($friendship);
    }

    public function destroy(Request $request, Friendship $friendship)
    {
        $u=$request->user();
        abort_unless(in_array($u->id,[$friendship->requester_id,$friendship->addressee_id]),403);
        $a = (int) $friendship->requester_id;
        $b = (int) $friendship->addressee_id;
        $friendship->delete();
        \App\Models\UserSubscription::where(function ($q) use ($a, $b) {
            $q->where(function ($x) use ($a, $b) {
                $x->where('subscriber_id', $a)->where('target_id', $b);
            })->orWhere(function ($x) use ($a, $b) {
                $x->where('subscriber_id', $b)->where('target_id', $a);
            });
        })->delete();
        return response()->json(['ok'=>true]);
    }

    public function status(Request $request, User $user)
    {
        $me=$request->user();
        abort_if(!$user->isDiscoverableBy($me), 404);
        $f=Friendship::where(function($q) use ($me,$user){
            $q->where('requester_id',$me->id)->where('addressee_id',$user->id)
              ->orWhere(fn($x)=>$x->where('requester_id',$user->id)->where('addressee_id',$me->id));
        })->first();
        return response()->json([
            'friendship'=>$f,
            'is_friend'=> $f?->status==='accepted',
            'is_pending'=> $f?->status==='pending',
            'is_blocked'=> UserBlock::where('blocker_id',$me->id)->where('blocked_id',$user->id)->exists(),
            'is_blocked_by'=> UserBlock::where('blocker_id',$user->id)->where('blocked_id',$me->id)->exists(),
            'can_message'=> $me->canMessageUser($user),
            'can_message_reason'=> $me->messageBlockReason($user),
        ]);
    }

    private function pushFriendRequest(int $addresseeId, User $requester): void
    {
        try {
            $push = app(\App\Services\WebPushService::class);
            if (! $push->isConfigured()) return;
            $addressee = User::select('id', 'name', 'avatar_path')->find($addresseeId);
            if ($addressee) $push->sendFriendRequest($addressee, $requester);
        } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('friend webpush failed: '.$e->getMessage()); }
    }
}
