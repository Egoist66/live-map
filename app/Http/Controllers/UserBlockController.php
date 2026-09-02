<?php

namespace App\Http\Controllers;

use App\Models\Friendship;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class UserBlockController extends Controller
{
    public function index(Request $request)
    {
        $blocks = UserBlock::where('blocker_id', $request->user()->id)
            ->with('blocked:id,name,avatar_path')
            ->get()->map(fn($b)=>['id'=>$b->id,'blocked'=>$b->blocked,'created_at'=>$b->created_at]);
        return response()->json($blocks);
    }

    public function store(Request $request)
    {
        $request->validate(['user_id'=>'required|exists:users,id']);
        $me=$request->user();
        $uid=(int)$request->input('user_id');
        abort_if($me->id===$uid,422,'Нельзя блокировать себя');
        $exists=UserBlock::where('blocker_id',$me->id)->where('blocked_id',$uid)->first();
        if($exists) return response()->json($exists,200);
        return DB::transaction(function() use($me,$uid){
            $b=UserBlock::create(['blocker_id'=>$me->id,'blocked_id'=>$uid]);
            Friendship::where(function($q) use($me,$uid){
                $q->where('requester_id',$me->id)->where('addressee_id',$uid)
                  ->orWhere(fn($x)=>$x->where('requester_id',$uid)->where('addressee_id',$me->id));
            })->delete();
            return response()->json($b,201);
        });
    }

    public function destroy(Request $request, User $user)
    {
        $me=$request->user();
        $b=UserBlock::where('blocker_id',$me->id)->where('blocked_id',$user->id)->first();
        abort_unless($b,404);
        $b->delete();
        return response()->json(['ok'=>true]);
    }
}
