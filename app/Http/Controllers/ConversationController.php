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
        $myRows = \App\Models\ConversationParticipant::where('user_id', $user->id)
            ->whereNull('hidden_at')
            ->get(['conversation_id', 'cleared_at'])
            ->keyBy('conversation_id');
        $convs = Conversation::whereHas('participantRows', fn($q)=>$q->where('user_id',$user->id)->whereNull('hidden_at'))
            ->with(['participants' => fn($q)=>$q->select('users.id','users.name','users.avatar_path','users.last_seen_at','users.is_invisible','users.plan','users.role','users.is_admin','users.dating_goal','users.dating_interests'), 'messages'=>fn($q)=>$q->reorder()->latest('id')->limit(1)])
            ->withCount(['messages as unread_count'=>fn($q)=>$q->where('sender_id','!=',$user->id)->whereNull('read_at')])
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->get();
        $matchedIds = \App\Models\DatingMatch::where('user_a_id', $user->id)
            ->orWhere('user_b_id', $user->id)
            ->get()
            ->map(fn($m) => $m->user_a_id === $user->id ? $m->user_b_id : $m->user_a_id)
            ->flip();
        $convs = $convs
            ->map(function($c) use ($user, $myRows, $matchedIds){
                $other = $c->participants->firstWhere('id','!=',$user->id);
                $lastSeen = $other && $other->isInvisibleActive() && !$user->isAdmin() ? null : $other?->last_seen_at?->toISOString();
                $clearedAt = $myRows->get($c->id)?->cleared_at;
                $last = $c->messages->first()?->toArrayPayload();
                if ($last && $clearedAt && $c->messages->first()->created_at <= $clearedAt) {
                    $last = null;
                }
                $unread = $c->unread_count;
                if ($clearedAt) {
                    $unread = Message::where('conversation_id', $c->id)
                        ->where('sender_id', '!=', $user->id)
                        ->whereNull('read_at')
                        ->where('created_at', '>', $clearedAt)
                        ->count();
                }
                return [
                    'id'=>$c->id,
                    'type'=>$c->type,
                    'pin_id'=>$c->pin_id,
                    'other'=>$other ? ['id'=>$other->id,'name'=>$other->name,'avatar_path'=>$other->avatar_path,'avatar_url'=>$other->avatar_url,'last_seen_at'=>$lastSeen,'is_invisible'=>$other->isInvisibleActive(),'is_match'=>$c->type === 'direct' && isset($matchedIds[$other->id]),'dating_goal'=>$other->dating_goal,'dating_interests'=>$other->dating_interests ?? []] : null,
                    'last_message'=>$last,
                    'unread_count'=>$unread,
                    'last_message_at'=>$c->last_message_at,
                    'updated_at'=>$c->updated_at,
                ];
            });
        return response()->json($convs);
    }

    public function show(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id), 403, 'Этот чат принадлежит другому аккаунту. Войдите под нужным пользователем.');
        $clearedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('cleared_at');
        $conversation->load(['participants:id,name,avatar_path,last_seen_at,is_invisible,plan,role,is_admin,dating_goal,dating_interests']);
        $rawMessages = $conversation->messages()
            ->with(['sender:id,name,avatar_path', 'replyTo.sender:id,name'])
            ->when($clearedAt, fn ($q) => $q->where('created_at', '>', $clearedAt))
            ->reorder()
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->reverse()
            ->values();
        $undelivered = $rawMessages->where('sender_id','!=',$request->user()->id)->whereNull('delivered_at')->pluck('id');
        if($undelivered->isNotEmpty()){
            Message::whereIn('id',$undelivered)->update(['delivered_at'=>now()]);
            $rawMessages->each(function($m) use ($undelivered){ if($undelivered->contains($m->id)) $m->delivered_at = now(); });
            try{ broadcast(new \App\Events\MessageDelivered($conversation->id,$undelivered->toArray(),$request->user()->id))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        }
        $messages = $rawMessages->map->toArrayPayload();
        $pinned = $conversation->messages()->with(['sender:id,name,avatar_path', 'replyTo.sender:id,name'])->whereNotNull('pinned_at')->orderBy('pinned_at')->get()->map->toArrayPayload();
        $other = $conversation->participants->firstWhere('id','!=',$request->user()->id);
        $lastSeen = $other && $other->isInvisibleActive() && !$request->user()->isAdmin() ? null : $other?->last_seen_at?->toISOString();
        $isMatch = $other && $conversation->type === 'direct'
            ? \App\Models\DatingMatch::between($request->user()->id, $other->id) !== null
            : false;
        return response()->json([
            'id'=>$conversation->id,
            'type'=>$conversation->type,
            'pin_id'=>$conversation->pin_id,
            'other'=>$other ? ['id'=>$other->id,'name'=>$other->name,'avatar_path'=>$other->avatar_path,'avatar_url'=>$other->avatar_url,'last_seen_at'=>$lastSeen,'is_invisible'=>$other->isInvisibleActive(),'is_match'=>$isMatch,'dating_goal'=>$other->dating_goal,'dating_interests'=>$other->dating_interests ?? []] : null,
            'participants'=>$conversation->participants->map(fn($p)=> array_merge($p->toArray(), ['avatar_url'=>$p->avatar_url])),
            'messages'=>$messages,
            'pinned'=>$pinned,
            'pin_limit'=>$request->user()->pinnedMessagesLimit(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate(['user_id'=>'required|exists:users,id','message'=>'nullable|string|max:2000']);
        $me=$request->user();
        $other=User::findOrFail($request->input('user_id'));
        abort_if(!$other->isDiscoverableBy($me), 404);
        if ($reason = $me->messageBlockReason($other)) {
            abort(403, $reason);
        }
        abort_unless($me->canMessageUser($other),403,'Нельзя написать этому пользователю. Проверьте настройки приватности или дружбу.');
        $existing = Conversation::findDirect($me->id,$other->id);
        if ($existing) {
            $existing->participantRows()->where('user_id',$me->id)->update(['hidden_at'=>null]);
            if ($request->filled('message')) {
                app(MessageController::class)->storeInline($request, $existing, $me, $request->input('message'));
                $existing->refresh();
            }
            return response()->json(['id'=>$existing->id,'existing'=>true],201);
        }
        $hiddenExisting = Conversation::where('type','direct')
            ->whereHas('participantRows', fn($q)=>$q->where('user_id',$other->id))
            ->whereHas('participantRows', fn($q)=>$q->where('user_id',$me->id)->whereNotNull('hidden_at'), '=', 1)
            ->first();
        if ($hiddenExisting) {
            $hiddenExisting->participantRows()->where('user_id',$me->id)->update(['hidden_at'=>null]);
            $hiddenExisting->update(['last_message_at'=>now()]);
            if ($request->filled('message')) {
                app(MessageController::class)->storeInline($request, $hiddenExisting, $me, $request->input('message'));
                $hiddenExisting->refresh();
            }
            return response()->json(['id'=>$hiddenExisting->id,'existing'=>true,'restored'=>true],201);
        }
        return DB::transaction(function() use ($me,$other,$request){
            app(\App\Services\DatingService::class)->tryConsumeRandomQuota($me->refresh(), $other);
            $conv=Conversation::create(['type'=>'direct','created_by'=>$me->id,'last_message_at'=>now()]);
            $conv->participantRows()->createMany([
                ['user_id'=>$me->id,'joined_at'=>now()],
                ['user_id'=>$other->id,'joined_at'=>now()],
            ]);
            if ($request->filled('message')) {
                $msg=Message::create(['conversation_id'=>$conv->id,'sender_id'=>$me->id,'body'=>$request->input('message')]);
                $msg->load('sender:id,name,avatar_path');
                $conv->update(['last_message_at'=>$msg->created_at]);
                try{ broadcast(new \App\Events\MessageSent($msg->load('conversation.participantRows')))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
                try {
                    $push = app(\App\Services\WebPushService::class);
                    if ($push->isConfigured()) $push->sendChatMessage($other, $me, $conv->id, (string) $request->input('message'));
                } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('chat webpush failed: '.$e->getMessage()); }
            }
            $conv->load('participants:id,name,avatar_path');
            return response()->json(['id'=>$conv->id,'existing'=>false,'conversation'=>$conv],201);
        });
    }

    public function markRead(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $now = now();
        $clearedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('cleared_at');
        $ids = Message::where('conversation_id',$conversation->id)->where('sender_id','!=',$request->user()->id)->whereNull('read_at')
            ->when($clearedAt, fn($q) => $q->where('created_at', '>', $clearedAt))
            ->pluck('id');
        Message::whereIn('id',$ids)->update(['read_at'=>$now,'delivered_at'=>\DB::raw('COALESCE(delivered_at, "'.$now->toDateTimeString().'")')]);
        $conversation->participantRows()->where('user_id',$request->user()->id)->update(['last_read_at'=>$now]);
        try{ broadcast(new \App\Events\MessageRead($conversation->id,$request->user()->id,$ids->toArray()))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json(['ok'=>true]);
    }

    public function markDelivered(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $clearedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('cleared_at');
        $ids = Message::where('conversation_id',$conversation->id)->where('sender_id','!=',$request->user()->id)->whereNull('delivered_at')
            ->when($clearedAt, fn($q) => $q->where('created_at', '>', $clearedAt))
            ->pluck('id');
        if($ids->isNotEmpty()){
            Message::whereIn('id',$ids)->update(['delivered_at'=>now()]);
            try{ broadcast(new \App\Events\MessageDelivered($conversation->id,$ids->toArray(),$request->user()->id))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        }
        return response()->json(['ok'=>true,'delivered_ids'=>$ids]);
    }

    public function destroy(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $conversation->participantRows()->where('user_id',$request->user()->id)->update(['hidden_at'=>now(),'cleared_at'=>now()]);
        return response()->json(['ok'=>true]);
    }

    /**
     * Убрать все диалоги из своего списка навсегда (у собеседников остаются).
     */
    public function clearAll(Request $request)
    {
        $now = now();
        $cleared = \App\Models\ConversationParticipant::where('user_id',$request->user()->id)
            ->whereNull('hidden_at')
            ->update(['hidden_at'=>$now,'cleared_at'=>$now]);
        return response()->json(['ok'=>true,'cleared'=>$cleared]);
    }
}
