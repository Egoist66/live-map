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
        $perPage = max(1, min(30, (int) $request->input('per_page', 20)));
        $blocked = $me->isAdmin() ? collect() : UserBlock::where('blocker_id',$me->id)->pluck('blocked_id')->merge(UserBlock::where('blocked_id',$me->id)->pluck('blocker_id'))->unique();
        $base = User::where('id','!=',$me->id)
            ->whereNotIn('id',$blocked)
            ->whereNotIn('id', User::hiddenFromSearchFor($me))
            ->where(fn($qq)=>$qq->where('name','like',"%$q%")->orWhere('email','like',"%$q%"));
        $page = $base->select('id','name','profile_slug','avatar_path','message_privacy','allow_random_messages','last_seen_at','is_invisible','plan','role','is_admin')
            ->orderBy('name')
            ->paginate($perPage);
        $users = $page->getCollection();
        $ids = $users->pluck('id')->all();
        $friendships = Friendship::where(function($q) use ($me,$ids){
                $q->where('requester_id',$me->id)->whereIn('addressee_id',$ids);
            })->orWhere(function($q) use ($me,$ids){
                $q->where('addressee_id',$me->id)->whereIn('requester_id',$ids);
            })->get()->keyBy(fn($f)=> $f->requester_id===$me->id ? $f->addressee_id : $f->requester_id);
        $rows = $users->map(fn($u)=>[
                'id'=>$u->id,
                'name'=>$u->name,
                'profile_slug'=>$u->profile_slug,
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
            ])->values();
        return response()->json([
            'data' => $rows,
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    public function heartbeat(Request $request)
    {
        if ($request->user()->isInvisibleActive()) {
            return response()->json(['ok' => true, 'invisible' => true]);
        }
        $request->user()->forceFill(['last_seen_at' => now()])->saveQuietly();
        return response()->json(['ok' => true]);
    }

    /**
     * Сохранение приватности чата — только дропдаун message_privacy.
     *
     * @param Request $request запрос с message_privacy (everyone|friends|none)
     * @return \Illuminate\Http\JsonResponse
     */
    public function privacy(Request $request)
    {
        $request->validate(['message_privacy' => 'required|in:everyone,friends,none', 'allow_random_messages' => 'sometimes|boolean']);
        $user = $request->user();
        $user->message_privacy = $request->input('message_privacy');
        if ($request->has('allow_random_messages')) {
            $user->allow_random_messages = (bool) $request->input('allow_random_messages');
        }
        $user->save();
        return response()->json($user->only(['message_privacy', 'allow_random_messages', 'photo_comments_privacy']));
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
