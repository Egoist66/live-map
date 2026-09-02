<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConversationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $convs = Conversation::whereHas('participantRows', fn($q)=>$q->where('user_id',$user->id))
            ->with(['participants:id,name,avatar_path','messages'=>fn($q)=>$q->latest()->limit(1)])
            ->withCount(['messages as unread_count'=>fn($q)=>$q->where('sender_id','!=',$user->id)->whereNull('read_at')])
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->get()
            ->map(function($c) use ($user){
                $other = $c->participants->firstWhere('id','!=',$user->id);
                return [
                    'id'=>$c->id,
                    'other'=>$other ? ['id'=>$other->id,'name'=>$other->name,'avatar_path'=>$other->avatar_path] : null,
                    'last_message'=>$c->messages->first()?->toArrayPayload(),
                    'unread_count'=>$c->unread_count,
                    'last_message_at'=>$c->last_message_at,
                    'updated_at'=>$c->updated_at,
                ];
            });
        return response()->json($convs);
    }

    public function show(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $conversation->load(['participants:id,name,avatar_path']);
        $messages = $conversation->messages()->with('sender:id,name,avatar_path')->orderBy('created_at')->limit(100)->get()->map->toArrayPayload();
        $other = $conversation->participants->firstWhere('id','!=',$request->user()->id);
        return response()->json([
            'id'=>$conversation->id,
            'other'=>$other ? ['id'=>$other->id,'name'=>$other->name,'avatar_path'=>$other->avatar_path] : null,
            'participants'=>$conversation->participants,
            'messages'=>$messages,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate(['user_id'=>'required|exists:users,id','message'=>'nullable|string|max:2000']);
        $me=$request->user();
        $other=User::findOrFail($request->input('user_id'));
        abort_unless($me->canMessageUser($other),403,'Нельзя написать этому пользователю. Проверьте настройки приватности или дружбу.');
        $existing = Conversation::findDirect($me->id,$other->id);
        if ($existing) {
            if ($request->filled('message')) {
                app(MessageController::class)->storeInline($request, $existing, $me, $request->input('message'));
                $existing->refresh();
            }
            return response()->json(['id'=>$existing->id,'existing'=>true],201);
        }
        return DB::transaction(function() use ($me,$other,$request){
            $conv=Conversation::create(['type'=>'direct','created_by'=>$me->id,'last_message_at'=>now()]);
            $conv->participantRows()->createMany([
                ['user_id'=>$me->id,'joined_at'=>now()],
                ['user_id'=>$other->id,'joined_at'=>now()],
            ]);
            if ($request->filled('message')) {
                $msg=Message::create(['conversation_id'=>$conv->id,'sender_id'=>$me->id,'body'=>$request->input('message')]);
                $msg->load('sender:id,name,avatar_path');
                $conv->update(['last_message_at'=>$msg->created_at]);
                broadcast(new \App\Events\MessageSent($msg->load('conversation.participantRows')))->toOthers();
            }
            $conv->load('participants:id,name,avatar_path');
            return response()->json(['id'=>$conv->id,'existing'=>false,'conversation'=>$conv],201);
        });
    }

    public function markRead(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        Message::where('conversation_id',$conversation->id)->where('sender_id','!=',$request->user()->id)->whereNull('read_at')->update(['read_at'=>now()]);
        $conversation->participantRows()->where('user_id',$request->user()->id)->update(['last_read_at'=>now()]);
        broadcast(new \App\Events\MessageRead($conversation->id,$request->user()->id))->toOthers();
        return response()->json(['ok'=>true]);
    }

    public function destroy(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $conversation->delete();
        return response()->json(['ok'=>true]);
    }
}
