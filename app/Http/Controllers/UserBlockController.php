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
            ->with('blocked:id,name,avatar_path,telegram_photo_url')
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
            try {
                $target=User::find($uid);

                if ($target) {
                    \App\Services\TrustScoreService::penalizeBlock($target);
                }
            } catch (\Throwable) {
            }
            return response()->json($b,201);
        });
    }

    /**
     * Разблокировать пользователя и вернуть диалог в список чатов.
     *
     * Блокировка никогда не удаляет переписку: скрытие/очистка истории
     * при блоке была багом фронта (DELETE /conversations). Здесь
     * снимаем hidden_at + cleared_at у своей строки участника direct-диалога,
     * чтобы чат и все сообщения снова появились. Чужие строки не трогаем.
     *
     * @param Request $request запрос
     * @param User $user разблокируемый пользователь
     * @return \Illuminate\Http\JsonResponse
     */
    public function destroy(Request $request, User $user)
    {
        $me=$request->user();
        $b=UserBlock::where('blocker_id',$me->id)->where('blocked_id',$user->id)->first();
        abort_unless($b,404);
        $b->delete();
        $this->restoreDirectConversation($me->id, $user->id);
        return response()->json(['ok'=>true]);
    }

    /**
     * Вернуть свой direct-диалог с пользователем в список с полной историей.
     *
     * @param int $meId кто разблокировал
     * @param int $otherId кого разблокировали
     * @return void
     */
    private function restoreDirectConversation(int $meId, int $otherId): void
    {
        $conv=\App\Models\Conversation::where('type','direct')
            ->whereHas('participantRows', fn($q)=>$q->where('user_id',$meId))
            ->whereHas('participantRows', fn($q)=>$q->where('user_id',$otherId))
            ->whereHas('participantRows', fn($q)=>$q, '=', 2)
            ->first();
        if(!$conv) return;
        $conv->participantRows()->where('user_id',$meId)->update(['hidden_at'=>null,'cleared_at'=>null]);
    }
}
