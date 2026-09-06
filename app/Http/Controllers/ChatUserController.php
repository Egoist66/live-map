<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserBlock;
use App\Models\Friendship;
use Illuminate\Http\Request;

class ChatUserController extends Controller
{
    public function search(Request $request)
    {
        $q = trim($request->input('q',''));
        abort_if(strlen($q)<2,422,'Минимум 2 символа');
        $me=$request->user();
        $blocked = $me->isAdmin() ? collect() : UserBlock::where('blocker_id',$me->id)->pluck('blocked_id')->merge(UserBlock::where('blocked_id',$me->id)->pluck('blocker_id'))->unique();
        $users = User::where('id','!=',$me->id)
            ->whereNotIn('id',$blocked)
            ->whereNotIn('id', User::hiddenFromSearchFor($me))
            ->where(fn($qq)=>$qq->where('name','like',"%$q%")->orWhere('email','like',"%$q%"))
            ->select('id','name','avatar_path','message_privacy','allow_random_messages','last_seen_at','is_invisible','plan','role','is_admin')
            ->limit(20)->get();
        $ids = $users->pluck('id')->all();
        $friendships = Friendship::where(function($q) use ($me,$ids){
                $q->where('requester_id',$me->id)->whereIn('addressee_id',$ids);
            })->orWhere(function($q) use ($me,$ids){
                $q->where('addressee_id',$me->id)->whereIn('requester_id',$ids);
            })->get()->keyBy(fn($f)=> $f->requester_id===$me->id ? $f->addressee_id : $f->requester_id);
        return $users->map(fn($u)=>[
                'id'=>$u->id,
                'name'=>$u->name,
                'avatar_path'=>$u->avatar_path,
                'avatar_url'=>$u->avatar_url,
                'can_message'=>$me->canMessageUser($u),
                'can_message_reason'=>$me->messageBlockReason($u),
                'message_privacy'=>$u->message_privacy,
                'allow_random_messages'=>$u->allow_random_messages,
                'last_seen_at'=>$u->isInvisibleActive() && !$me->isAdmin() ? null : $u->last_seen_at?->toISOString(),
                'is_invisible'=>$u->isInvisibleActive(),
                'is_friend'=>($friendships[$u->id]?->status ?? null)==='accepted',
                'is_pending'=>($friendships[$u->id]?->status ?? null)==='pending',
                'friendship_outgoing'=>($friendships[$u->id]?->status ?? null)==='pending' ? ($friendships[$u->id]->requester_id===$me->id) : null,
            ]);
        return response()->json($users);
    }

    public function heartbeat(Request $request)
    {
        if ($request->user()->isInvisibleActive()) {
            return response()->json(['ok' => true, 'invisible' => true]);
        }
        $request->user()->forceFill(['last_seen_at' => now()])->saveQuietly();
        return response()->json(['ok' => true]);
    }

    public function privacy(Request $request)
    {
        $request->validate(['message_privacy'=>'required|in:everyone,friends,none','allow_random_messages'=>'required|boolean']);
        $request->user()->update($request->only(['message_privacy','allow_random_messages']));
        return response()->json($request->user()->only(['message_privacy','allow_random_messages','photo_comments_privacy']));
    }

    public function me(Request $request)
    {
        $u=$request->user();
        return response()->json([
            'id'=>$u->id,
            'name'=>$u->name,
            'avatar_path'=>$u->avatar_path,
            'avatar_url'=>$u->avatar_url,
            'message_privacy'=>$u->message_privacy,
            'allow_random_messages'=>$u->allow_random_messages,
            'unread_count'=>$u->unreadMessagesCount(),
            'last_seen_at'=>$u->last_seen_at?->toISOString(),
            'is_invisible'=>$u->isInvisibleActive(),
            'can_use_invisible'=>$u->canUseInvisible(),
        ]);
    }
}
