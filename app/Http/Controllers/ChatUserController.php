<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\Request;

class ChatUserController extends Controller
{
    public function search(Request $request)
    {
        $q = trim($request->input('q',''));
        abort_if(strlen($q)<2,422,'Минимум 2 символа');
        $me=$request->user();
        $blocked = UserBlock::where('blocker_id',$me->id)->pluck('blocked_id')->merge(UserBlock::where('blocked_id',$me->id)->pluck('blocker_id'))->unique();
        $users = User::where('id','!=',$me->id)
            ->whereNotIn('id',$blocked)
            ->where(fn($qq)=>$qq->where('name','like',"%$q%")->orWhere('email','like',"%$q%"))
            ->select('id','name','avatar_path','message_privacy','allow_random_messages')
            ->limit(20)->get()
            ->map(fn($u)=>[
                'id'=>$u->id,
                'name'=>$u->name,
                'avatar_path'=>$u->avatar_path,
                'avatar_url'=>$u->avatar_url,
                'can_message'=>$me->canMessageUser($u),
                'can_message_reason'=>$me->messageBlockReason($u),
                'message_privacy'=>$u->message_privacy,
                'allow_random_messages'=>$u->allow_random_messages,
            ]);
        return response()->json($users);
    }

    public function privacy(Request $request)
    {
        $request->validate(['message_privacy'=>'required|in:everyone,friends,none','allow_random_messages'=>'required|boolean']);
        $request->user()->update($request->only(['message_privacy','allow_random_messages']));
        return response()->json($request->user()->only(['message_privacy','allow_random_messages']));
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
        ]);
    }
}
