<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Events\MessageUpdated;
use App\Events\TypingIndicator;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\ChatAttachment;
use App\Services\WebPushService;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function index(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $clearedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('cleared_at');
        $before = $request->input('before');
        $q = $conversation->messages()->with(['sender:id,name,avatar_path', 'replyTo.sender:id,name'])->reorder()->orderByDesc('id');
        if ($before) $q->where('id','<',$before);
        if ($clearedAt) $q->where('created_at', '>', $clearedAt);
        $collection = $q->limit(30)->get();
        $undelivered = $collection->where('sender_id','!=',$request->user()->id)->whereNull('delivered_at')->pluck('id');
        if($undelivered->isNotEmpty()){
            Message::whereIn('id',$undelivered)->update(['delivered_at'=>now()]);
            $collection->each(function($m) use ($undelivered){ if($undelivered->contains($m->id)) $m->delivered_at = now(); });
            try{ broadcast(new \App\Events\MessageDelivered($conversation->id,$undelivered->toArray(),$request->user()->id))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        }
        $messages = $collection->reverse()->values()->map->toArrayPayload();
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
        $data = $request->validate([
            'body' => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|max:10240',
            'reply_to_id' => 'nullable|integer|exists:messages,id',
        ]);
        $body = trim((string) ($data['body'] ?? ''));
        $hasFile = $request->hasFile('attachment');
        abort_if($body === '' && ! $hasFile, 422, 'Нужно сообщение или файл');
        $attachment = $this->resolveAttachment($request);
        $replyToId = $this->resolveReplyTo($conversation, $data['reply_to_id'] ?? null);
        return $this->storeInline($request, $conversation, $request->user(), $body, $replyToId, $attachment);
    }

    /**
     * Проверяет, что цитируемое сообщение из того же чата.
     */
    private function resolveReplyTo(Conversation $conversation, ?int $replyToId): ?int
    {
        if (! $replyToId) return null;
        $orig = Message::whereKey($replyToId)->first(['id', 'conversation_id']);
        abort_if(! $orig || (int) $orig->conversation_id !== (int) $conversation->id, 422, 'Сообщение для ответа не найдено в этом чате');
        return $orig->id;
    }

    /**
     * Проверяет и сохраняет вложение из multipart-запроса.
     */
    private function resolveAttachment(Request $request): ?array
    {
        if (! $request->hasFile('attachment')) {
            return null;
        }
        $file = $request->file('attachment');
        $kind = ChatAttachment::validate($file);

        return ChatAttachment::store($file, $kind);
    }

    public function storeInline(Request $request, Conversation $conversation, $sender, string $body, ?int $replyToId = null, ?array $attachment = null)
    {
        $conversation->loadMissing('participants:id,name,message_privacy,allow_random_messages');
        $other = $conversation->participants->firstWhere('id','!=',$sender->id);
        if ($other && $reason = $sender->messageBlockReason($other)) {
            if ($attachment) {
                ChatAttachment::delete($attachment['path']);
            }
            abort(403, $reason);
        }
        $kind = $attachment['kind'] ?? null;
        $type = $kind === 'image' ? 'image' : ($kind === 'file' ? 'file' : 'text');
        $msg = Message::create([
            'conversation_id' => $conversation->id,
            'reply_to_id' => $replyToId,
            'sender_id' => $sender->id,
            'body' => $body,
            'type' => $type,
            'attachment_path' => $attachment['path'] ?? null,
            'attachment_name' => $attachment['name'] ?? null,
            'attachment_mime' => $attachment['mime'] ?? null,
            'attachment_size' => $attachment['size'] ?? null,
            'attachment_kind' => $kind,
        ]);
        $msg->load(['sender:id,name,avatar_path','replyTo.sender:id,name','conversation.participantRows']);
        $conversation->update(['last_message_at'=>$msg->created_at]);
        $conversation->participantRows()->whereNotNull('hidden_at')->update(['hidden_at'=>null]);
        try{ broadcast(new MessageSent($msg))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        $this->pushToRecipients($conversation, $sender, $msg);
        return response()->json($msg->toArrayPayload(),201);
    }

    private function pushToRecipients(Conversation $conversation, $sender, Message $msg): void
    {
        try {
            $ids = $conversation->participantRows()->where('user_id', '!=', $sender->id)->pluck('user_id');
            if ($ids->isEmpty()) return;
            $senderModel = $sender instanceof User ? $sender : User::select('id', 'name', 'avatar_path')->find($sender->id);
            $text = trim((string) $msg->body);
            if ($text === '' && $msg->attachment_path) {
                $label = $msg->attachment_name ? ' ' . $msg->attachment_name : '';
                $text = ($msg->attachment_kind === 'image' ? '📷 Фото' : '📎 Файл') . $label;
            }
            foreach (User::whereIn('id', $ids)->select('id', 'name', 'avatar_path')->get() as $recipient) {
                // Web Push — только если настроен VAPID (для веба), Expo — всегда (для Android).
                // Раньше тут был ранний return при ненастроенном VAPID — он глушил и Expo.
                try {
                    $push = app(WebPushService::class);
                    if ($push->isConfigured()) $push->sendChatMessage($recipient, $senderModel ?? $recipient, $conversation->id, $text);
                } catch (\Throwable) {}
                try { app(\App\Services\ExpoPushService::class)->sendChatMessage($recipient, $senderModel ?? $recipient, $conversation->id, $text); } catch (\Throwable) {}
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('chat webpush failed: '.$e->getMessage());
        }
    }

    public function typing(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $request->validate(['is_typing'=>'required|boolean']);
        $isTyping = (bool) $request->input('is_typing');
        $key = "typing:{$conversation->id}:{$request->user()->id}";
        if ($isTyping) {
            \Illuminate\Support\Facades\Cache::put($key, true, 5);
        } else {
            \Illuminate\Support\Facades\Cache::forget($key);
        }
        try{ broadcast(new TypingIndicator($conversation->id,$request->user()->id,$isTyping))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
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
        $path = $message->attachment_path;
        $message->delete();
        ChatAttachment::delete($path);
        try { broadcast(new \App\Events\MessageDeleted($mid, $cid))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json(['ok'=>true]);
    }

    public function pinned(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $list = $conversation->messages()
            ->with(['sender:id,name,avatar_path', 'replyTo.sender:id,name'])
            ->whereNotNull('pinned_at')
            ->orderBy('pinned_at')
            ->get()
            ->map->toArrayPayload();
        return response()->json([
            'pinned' => $list,
            'pin_limit' => $request->user()->pinnedMessagesLimit(),
        ]);
    }

    public function pin(Request $request, Message $message)
    {
        $me = $request->user();
        abort_unless($message->conversation->hasParticipant($me->id),403);
        if ($message->pinned_at) return response()->json($message->refresh()->toArrayPayload());
        $limit = $me->pinnedMessagesLimit();
        if ($limit !== null) {
            $count = Message::where('conversation_id', $message->conversation_id)->whereNotNull('pinned_at')->count();
            abort_if($count >= $limit, 422, 'Лимит закреплённых сообщений: ' . $limit);
        }
        $message->update(['pinned_at' => now(), 'pinned_by' => $me->id]);
        $message->refresh();
        try { broadcast(new \App\Events\MessagePinned($message))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json($message->toArrayPayload());
    }

    public function unpin(Request $request, Message $message)
    {
        abort_unless($message->conversation->hasParticipant($request->user()->id),403);
        if (!$message->pinned_at) return response()->json($message->toArrayPayload());
        $message->update(['pinned_at' => null, 'pinned_by' => null]);
        $message->refresh();
        try { broadcast(new \App\Events\MessagePinned($message))->toOthers(); } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json($message->toArrayPayload());
    }
}
