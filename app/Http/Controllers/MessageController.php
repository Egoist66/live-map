<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Events\MessageUpdated;
use App\Events\TypingIndicator;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
use App\Services\ActivityRewards;
use App\Services\ChatAttachment;
use App\Services\WebPushService;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    /**
     * Размер страницы истории чата: как в мессенджерах, подгрузка порциями вверх.
     */
    public const HISTORY_PAGE_SIZE = 15;

    public function index(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $clearedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('cleared_at');
        $before = $request->input('before');
        $limit = max(1, min(50, (int) $request->input('limit', self::HISTORY_PAGE_SIZE)));
        $q = $conversation->messages()->with(['sender:id,name,avatar_path', 'replyTo.sender:id,name'])->reorder()->orderByDesc('id');
        if ($before) $q->where('id','<',$before);
        if ($clearedAt) $q->where('created_at', '>', $clearedAt);
        $collection = $q->limit($limit + 1)->get();
        $hasMore = $collection->count() > $limit;
        $collection = $collection->take($limit);
        // Доставку отмечает отдельный POST /conversations/{id}/delivered
        // (фронт шлёт его сам) — из чтения истории write и broadcast убраны,
        // чтобы открытие чата не блокировалось на UPDATE + Reverb.
        $messages = $collection->reverse()->values()->map->toArrayPayload();
        return response()->json(['data' => $messages, 'has_more' => $hasMore]);
    }

    public function store(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        \App\Services\EmailVerificationGate::assertCanWrite($request->user());
        $conversation->loadMissing('participants:id,name,message_privacy,allow_random_messages');
        $other = $conversation->participants->firstWhere('id','!=',$request->user()->id);
        if ($conversation->type !== 'district' && $other && $reason = $request->user()->messageBlockReason($other)) {
            abort(403, $reason);
        }
        $data = $request->validate([
            'body' => 'nullable|string|max:2000',
            'attachment' => 'nullable|file|max:10240',
            'reply_to_id' => 'nullable|integer|exists:messages,id',
            'voice_duration' => 'nullable|integer|min:1|max:60',
            'shared_post_type' => 'nullable|in:flow,district',
            'shared_post_id' => 'nullable|integer|min:1',
        ]);
        $body = trim((string) ($data['body'] ?? ''));
        $hasFile = $request->hasFile('attachment');
        $shared = $this->resolveSharedPost($request->user(), $data['shared_post_type'] ?? null, isset($data['shared_post_id']) ? (int) $data['shared_post_id'] : null);
        abort_if($body === '' && ! $hasFile && ! $shared, 422, 'Нужно сообщение или файл');
        $attachment = $this->resolveAttachment($request);
        $replyToId = $this->resolveReplyTo($conversation, $data['reply_to_id'] ?? null);
        $voiceDuration = isset($data['voice_duration']) ? (int) $data['voice_duration'] : null;
        if ($voiceDuration !== null && ($attachment['kind'] ?? null) !== 'voice') {
            $voiceDuration = null;
        }
        return $this->storeInline($request, $conversation, $request->user(), $body, $replyToId, $attachment, $voiceDuration, $shared);
    }

    /**
     * Проверить пересланный пост: тип + существование + видимость для отправителя.
     *
     * Анонимность не блокирует шаринг — автор скрывается в пейлоаде.
     * Блокировка между отправителем и автором поста блокирует шаринг чужого поста.
     *
     * @param \App\Models\User $sender отправитель
     * @param string|null $type flow|district
     * @param int|null $postId id поста
     * @return array{type:string,id:int}|null
     */
    public function resolveSharedPost($sender, ?string $type, ?int $postId): ?array
    {
        if (! $type && ! $postId) {
            return null;
        }

        abort_if(! $type || ! $postId, 422, 'Укажите тип и id поста');

        if ($type === 'flow') {
            $post = \App\Models\FlowPost::with('user:id,name,is_admin')->find($postId);
            abort_if(! $post, 404, 'Пост не найден');

            $author = $post->user;

            if ($author && (int) $author->id !== (int) $sender->id && ! $sender->isAdmin()) {
                $blocked = \App\Models\UserBlock::where(function ($query) use ($sender, $author) {
                    $query->where(function ($inner) use ($sender, $author) {
                        $inner->where('blocker_id', $sender->id)->where('blocked_id', $author->id);
                    })->orWhere(function ($inner) use ($sender, $author) {
                        $inner->where('blocker_id', $author->id)->where('blocked_id', $sender->id);
                    });
                })->exists();

                abort_if($blocked, 403, 'Недоступно');

                if (! $author->is_admin) {
                    abort_unless($author->isDiscoverableBy($sender), 404, 'Пост не найден');
                }
            }

            return ['type' => 'flow', 'id' => (int) $post->id];
        }

        if ($type === 'district') {
            $post = \App\Models\DistrictPost::find($postId);
            abort_if(! $post, 404, 'Новость не найдена');

            return ['type' => 'district', 'id' => (int) $post->id];
        }

        abort(422, 'Неизвестный тип поста');

        return null;
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

    /**
     * Создать сообщение внутри чата: текст / вложение / пересланный пост.
     *
     * Пересылка поста хранится полями shared_post_type + shared_post_id,
     * тип сообщения — post (превью строится живым в Message::sharedPostPayload).
     *
     * @param Request $request запрос
     * @param Conversation $conversation чат
     * @param mixed $sender отправитель
     * @param string $body сопроводительный текст
     * @param int|null $replyToId цитата
     * @param array|null $attachment вложение
     * @param int|null $voiceDuration длительность голосового
     * @param array|null $shared ['type' => flow|district, 'id' => int]
     */
    public function storeInline(Request $request, Conversation $conversation, $sender, string $body, ?int $replyToId = null, ?array $attachment = null, ?int $voiceDuration = null, ?array $shared = null)
    {
        \App\Services\EmailVerificationGate::assertCanWrite($sender instanceof User ? $sender : User::findOrFail($sender->id));
        $conversation->loadMissing('participants:id,name,message_privacy,allow_random_messages');
        $other = $conversation->participants->firstWhere('id','!=',$sender->id);
        if ($conversation->type !== 'district' && $other && $reason = $sender->messageBlockReason($other)) {
            if ($attachment) {
                ChatAttachment::delete($attachment['path']);
            }
            abort(403, $reason);
        }
        $kind = $attachment['kind'] ?? null;
        $type = $shared ? 'post' : ($kind === 'image' ? 'image' : ($kind === 'voice' ? 'voice' : ($kind === 'file' ? 'file' : 'text')));
        $duration = $kind === 'voice' && $voiceDuration ? max(1, min(60, $voiceDuration)) : null;
        $msg = Message::create([
            'conversation_id' => $conversation->id,
            'reply_to_id' => $replyToId,
            'shared_post_type' => $shared['type'] ?? null,
            'shared_post_id' => $shared['id'] ?? null,
            'sender_id' => $sender->id,
            'body' => $body,
            'type' => $type,
            'attachment_path' => $attachment['path'] ?? null,
            'attachment_name' => $attachment['name'] ?? null,
            'attachment_mime' => $attachment['mime'] ?? null,
            'attachment_size' => $attachment['size'] ?? null,
            'attachment_kind' => $kind,
            'attachment_duration' => $duration,
        ]);
        $msg->load(['sender:id,name,avatar_path','replyTo.sender:id,name','conversation.participantRows']);
        $conversation->update(['last_message_at'=>$msg->created_at]);
        $conversation->participantRows()->whereNotNull('hidden_at')->update(['hidden_at'=>null]);
        try{ broadcast(new MessageSent($msg))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        $this->pushToRecipients($conversation, $sender, $msg);
        $senderModel = $sender instanceof User ? $sender : User::find($sender->id);
        if ($senderModel) {
            try {
                app(\App\Services\ChatAutoReply::class)->maybeReply($conversation, $senderModel, $msg);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('chat autoreply failed: '.$e->getMessage());
            }
        }
        $payload = $msg->toArrayPayload();

        if ($senderModel) {
            $reward = ActivityRewards::award($senderModel, 'chat_message');

            if ($reward !== null) {
                $payload['reward'] = $reward;
            }
        }

        return response()->json($payload,201);
    }

    private function pushToRecipients(Conversation $conversation, $sender, Message $msg): void
    {
        try {
            $ids = $conversation->participantRows()->where('user_id', '!=', $sender->id)->pluck('user_id');
            if ($ids->isEmpty()) return;
            $senderModel = $sender instanceof User ? $sender : User::select('id', 'name', 'avatar_path')->find($sender->id);
            $text = trim((string) $msg->body);
            if ($text === '' && $msg->shared_post_type) {
                $text = $msg->shared_post_type === 'district' ? '📰 Новость района' : '📝 Пост';
            }
            if ($text === '' && $msg->attachment_path) {
                if ($msg->attachment_kind === 'voice') {
                    $text = '🎤 Голосовое сообщение';
                    if ($msg->attachment_duration) {
                        $text .= ' ('.$msg->attachment_duration.' c)';
                    }
                } else {
                    $label = $msg->attachment_name ? ' ' . $msg->attachment_name : '';
                    $text = ($msg->attachment_kind === 'image' ? '📷 Фото' : '📎 Файл') . $label;
                }
            }
            foreach (User::whereIn('id', $ids)->select('id', 'name', 'email', 'email_verified_at', 'avatar_path', 'telegram_id', 'telegram_notify_messages', 'telegram_blocked_at', 'last_seen_at')->get() as $recipient) {
                // Web Push — только если настроен VAPID (для веба), Expo — всегда (для Android).
                // Раньше тут был ранний return при ненастроенном VAPID — он глушил и Expo.
                try {
                    $push = app(WebPushService::class);
                    if ($push->isConfigured()) $push->sendChatMessage($recipient, $senderModel ?? $recipient, $conversation->id, $text);
                } catch (\Throwable) {}
                try { app(\App\Services\ExpoPushService::class)->sendChatMessage($recipient, $senderModel ?? $recipient, $conversation->id, $text); } catch (\Throwable) {}
                try { \App\Services\TelegramNotifier::chatMessage($senderModel ?? $recipient, $recipient, $conversation, mb_substr($text, 0, 200), (int) $msg->id); } catch (\Throwable) {}
                try {
                    $senderForMail = $senderModel ?? $recipient;
                    \App\Services\DatingEmailNotifier::newMessage($senderForMail, $recipient, $conversation, mb_substr($text, 0, 200));
                } catch (\Throwable) {}
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
