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
            ->with(['requester:id,name,avatar_path','addressee:id,name,avatar_path'])
            ->get()->map(fn($f)=>[
                'id'=>$f->id,
                'status'=>$f->status,
                'other'=> $f->requester_id===$u->id ? $f->addressee : $f->requester,
                'created_at'=>$f->created_at,
            ]);
        $pendingIn = Friendship::where('status','pending')->where('addressee_id',$u->id)->with('requester:id,name,avatar_path')->get();
        $pendingOut = Friendship::where('status','pending')->where('requester_id',$u->id)->with('addressee:id,name,avatar_path')->get();
        return response()->json(['friends'=>$friends,'pending_in'=>$pendingIn,'pending_out'=>$pendingOut]);
    }

    public function store(Request $request)
    {
        $request->validate(['user_id'=>'required|exists:users,id']);
        $me = $request->user();
        $otherId = (int)$request->input('user_id');
        abort_if($me->id===$otherId,422,'Нельзя добавить себя');
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
        $friendship->delete();
        return response()->json(['ok'=>true]);
    }

    public function status(Request $request, User $user)
    {
        $me=$request->user();
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
