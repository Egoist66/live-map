<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Events\MessageUpdated;
use App\Events\TypingIndicator;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $before = $request->input('before');
        $q = $conversation->messages()->with('sender:id,name,avatar_path')->orderByDesc('created_at');
        if ($before) $q->where('id','<',$before);
        $messages = $q->limit(30)->get()->reverse()->values()->map->toArrayPayload();
        return response()->json($messages);
    }

    public function store(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $conversation->loadMissing('participants:id,name,message_privacy,allow_random_messages');
        $other = $conversation->participants->firstWhere('id','!=',$request->user()->id);
        if ($other && $reason = $request->user()->messageBlockReason($other)) {
            abort(403, $reason);
        }
        $data=$request->validate(['body'=>'required|string|max:2000']);
        return $this->storeInline($request,$conversation,$request->user(),$data['body']);
    }

    public function storeInline(Request $request, Conversation $conversation, $sender, string $body)
    {
        $conversation->loadMissing('participants:id,name,message_privacy,allow_random_messages');
        $other = $conversation->participants->firstWhere('id','!=',$sender->id);
        if ($other && $reason = $sender->messageBlockReason($other)) {
            abort(403, $reason);
        }
        $msg=Message::create(['conversation_id'=>$conversation->id,'sender_id'=>$sender->id,'body'=>$body]);
        $msg->load(['sender:id,name,avatar_path','conversation.participantRows']);
        $conversation->update(['last_message_at'=>$msg->created_at]);
        $conversation->participantRows()->whereNotNull('hidden_at')->update(['hidden_at'=>null]);
        try{ broadcast(new MessageSent($msg))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json($msg->toArrayPayload(),201);
    }

    public function typing(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $request->validate(['is_typing'=>'required|boolean']);
        try{ broadcast(new TypingIndicator($conversation->id,$request->user()->id,(bool)$request->input('is_typing')))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json(['ok'=>true]);
    }

    public function update(Request $request, Message $message)
    {
        abort_unless($message->sender_id === $request->user()->id, 403);
        abort_unless($message->conversation->hasParticipant($request->user()->id), 403);
        $data = $request->validate(['body' => 'required|string|max:2000']);
        $message->update(['body' => $data['body'], 'edited_at' => now()]);
        $message->load(['sender:id,name,avatar_path', 'conversation.participantRows']);
        try { broadcast(new MessageUpdated($message))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json($message->toArrayPayload());
    }

    public function destroy(Request $request, Message $message)
    {
        abort_unless($message->sender_id===$request->user()->id || $request->user()->isAdmin(),403);
        $cid = $message->conversation_id;
        $mid = $message->id;
        $message->delete();
        try { broadcast(new \App\Events\MessageDeleted($mid, $cid))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json(['ok'=>true]);
    }
}
