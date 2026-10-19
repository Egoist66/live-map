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
        $perPage = max(1, min(50, (int) $request->input('per_page', 20)));
        $onlyUnread = $request->boolean('only_unread');
        $myRows = \App\Models\ConversationParticipant::where('user_id', $user->id)
            ->whereNull('hidden_at')
            ->get(['conversation_id', 'cleared_at', 'pinned_at'])
            ->keyBy('conversation_id');
        $myPin = \App\Models\ConversationParticipant::select('pinned_at')
            ->whereColumn('conversation_participants.conversation_id', 'conversations.id')
            ->where('conversation_participants.user_id', $user->id)
            ->limit(1);
        $query = Conversation::whereHas('participantRows', fn($q)=>$q->where('user_id',$user->id)->whereNull('hidden_at'))
            ->with(['participants' => fn($q)=>$q->select('users.id','users.name','users.profile_slug','users.avatar_path','users.telegram_photo_url','users.last_seen_at','users.is_invisible','users.plan','users.role','users.is_admin','users.account_type','users.dating_goal','users.dating_interests'), 'messages'=>fn($q)=>$q->reorder()->latest('id')->limit(1), 'district:id,name,user_id'])
            ->withCount(['messages as unread_count'=>fn($q)=>$q->where('sender_id','!=',$user->id)->whereNull('read_at')])
            ->select('conversations.*')
            ->selectSub($myPin, 'my_pinned_at');

        // Панель колокольчика показывает только входящие: фильтр по непрочитанным
        // снимает и «мои отправленные», и уводит за пределы топ-страницы —
        // иначе «прочитать всё» гасит лишь видимые строки и бейдж зависает.
        if ($onlyUnread) {
            $query->whereIn('conversations.id', $this->unreadConversationIds((int) $user->id));
        }

        $page = $query
            ->orderByRaw('CASE WHEN my_pinned_at IS NULL THEN 1 ELSE 0 END')
            ->orderByDesc('my_pinned_at')
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->paginate($perPage);
        $convs = $page->getCollection();
        $matchedIds = \App\Models\DatingMatch::where('user_a_id', $user->id)
            ->orWhere('user_b_id', $user->id)
            ->get()
            ->map(fn($m) => $m->user_a_id === $user->id ? $m->user_b_id : $m->user_a_id)
            ->flip();
        $otherIds = $convs
            ->map(fn($c) => $c->participants->firstWhere('id', '!=', $user->id)?->id)
            ->filter()
            ->unique()
            ->values()
            ->all();
        $orgMap = $this->organizationMap($otherIds);

        try {
            $avatarUsers = $convs->flatMap(fn ($c) => $c->participants->all())->all();
            \App\Services\UserAvatarService::attachGalleryFallback($avatarUsers);
        } catch (\Throwable) {
        }

        $convs = $convs
            ->map(fn ($c) => $this->serializeRow($c, $user, $myRows, $matchedIds, $orgMap))
            ->values();
        // Backward-compatible: plain array when one page, paginated envelope otherwise.
        // Frontend usePaginatedList handles both shapes.
        if ($page->lastPage() <= 1) {
            return response()->json($convs);
        }
        return response()->json([
            'data' => $convs,
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'has_more' => $page->hasMorePages(),
        ]);
    }

    /**
     * Дельта-синк списка диалогов для offline-кеша (IndexedDB).
     *
     * Клиент рисует кеш мгновенно и зовёт sync с курсором прошлого синка:
     * в ответ только изменившиеся диалоги + id удалённых у себя
     * (hidden_at с другого устройства). Без курсора — полный первый синк.
     *
     * @param Request $request запрос с ?since=ms
     * @return \Illuminate\Http\JsonResponse
     */
    public function sync(Request $request)
    {
        $user = $request->user();
        $data = $request->validate(['since' => 'nullable|integer|min:0']);
        $window = empty($data['since'])
            ? null
            : \Carbon\Carbon::createFromTimestampMs((int) $data['since'])->subSeconds(10);

        $myRows = \App\Models\ConversationParticipant::where('user_id', $user->id)
            ->whereNull('hidden_at')
            ->get(['conversation_id', 'cleared_at', 'pinned_at'])
            ->keyBy('conversation_id');
        $myPin = \App\Models\ConversationParticipant::select('pinned_at')
            ->whereColumn('conversation_participants.conversation_id', 'conversations.id')
            ->where('conversation_participants.user_id', $user->id)
            ->limit(1);

        $query = Conversation::whereHas('participantRows', fn($q)=>$q->where('user_id',$user->id)->whereNull('hidden_at'))
            ->with(['participants' => fn($q)=>$q->select('users.id','users.name','users.profile_slug','users.avatar_path','users.telegram_photo_url','users.last_seen_at','users.is_invisible','users.plan','users.role','users.is_admin','users.account_type','users.dating_goal','users.dating_interests'), 'messages'=>fn($q)=>$q->reorder()->latest('id')->limit(1), 'district:id,name,user_id'])
            ->withCount(['messages as unread_count'=>fn($q)=>$q->where('sender_id','!=',$user->id)->whereNull('read_at')])
            ->select('conversations.*')
            ->selectSub($myPin, 'my_pinned_at');

        if ($window) {
            $query->where(fn ($q) => $q->where('last_message_at', '>', $window)->orWhere('updated_at', '>', $window));
        }

        $convs = $query
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->limit(100)
            ->get();

        $matchedIds = \App\Models\DatingMatch::where('user_a_id', $user->id)
            ->orWhere('user_b_id', $user->id)
            ->get()
            ->map(fn($m) => $m->user_a_id === $user->id ? $m->user_b_id : $m->user_a_id)
            ->flip();
        $otherIds = $convs
            ->map(fn($c) => $c->participants->firstWhere('id', '!=', $user->id)?->id)
            ->filter()
            ->unique()
            ->values()
            ->all();
        $orgMap = $this->organizationMap($otherIds);

        try {
            $avatarUsers = $convs->flatMap(fn ($c) => $c->participants->all())->all();
            \App\Services\UserAvatarService::attachGalleryFallback($avatarUsers);
        } catch (\Throwable) {
        }

        $rows = $convs
            ->map(fn ($c) => $this->serializeRow($c, $user, $myRows, $matchedIds, $orgMap))
            ->values();

        $removedIds = $window
            ? \App\Models\ConversationParticipant::where('user_id', $user->id)
                ->whereNotNull('hidden_at')
                ->where('hidden_at', '>', $window)
                ->pluck('conversation_id')
                ->map(fn ($id) => (int) $id)
                ->all()
            : [];

        return response()->json([
            'data' => $rows,
            'removed_ids' => array_values($removedIds),
            'server_time' => now()->valueOf(),
        ]);
    }

    /**
     * Одна строка сайдбара: общий сериализатор index и sync.
     *
     * @param Conversation $c диалог с подгруженными связями
     * @param \App\Models\User $user смотрящий
     * @param \Illuminate\Support\Collection $myRows мои строки участников по conversation_id
     * @param \Illuminate\Support\Collection $matchedIds flip id мэтчей
     * @param array<int, array|null> $orgMap организации собеседников
     * @return array<string, mixed>
     */
    private function serializeRow($c, $user, $myRows, $matchedIds, $orgMap): array
    {
        $other = $c->participants->firstWhere('id', '!=', $user->id);
        $lastSeen = $other && $other->isInvisibleActive() && ! $user->isAdmin() ? null : $other?->last_seen_at?->toISOString();
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

        $isDistrictOwner = $c->type === 'district' && $c->district && ((int) $c->district->user_id === (int) $user->id || $user->isAdmin());
        $otherOrg = $other ? ($orgMap[(int) $other->id] ?? null) : null;
        $pinnedAt = $myRows->get($c->id)?->pinned_at;

        return [
            'id' => $c->id,
            'type' => $c->type,
            'pin_id' => $c->pin_id,
            'district_id' => $c->district_id,
            'title' => $c->type === 'district' ? ($c->district?->name ?? 'Район') : null,
            'can_invite' => $isDistrictOwner,
            'is_pinned' => $pinnedAt !== null,
            'pinned_at' => $pinnedAt?->toISOString(),
            'other' => $other ? ['id' => $other->id, 'name' => $other->name, 'profile_slug' => $other->profile_slug, 'avatar_path' => $other->avatar_path, 'telegram_photo_url' => $other->telegram_photo_url, 'avatar_url' => $other->avatar_url, 'last_seen_at' => $lastSeen, 'is_invisible' => $other->isInvisibleActive(), 'is_match' => $c->type === 'direct' && isset($matchedIds[$other->id]), 'dating_goal' => $other->dating_goal, 'dating_interests' => $other->dating_interests ?? [], 'account_type' => $other->account_type ?? 'person', 'is_business' => ($other->account_type ?? 'person') === 'business', 'is_organization' => (bool) ($otherOrg['is_organization'] ?? false), 'business' => $otherOrg] : null,
            'last_message' => $last,
            'unread_count' => $unread,
            'last_message_at' => $c->last_message_at,
            'updated_at' => $c->updated_at,
            'wallpaper' => $c->wallpaperPayload(),
        ];
    }

    public function show(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id), 403, 'Этот чат принадлежит другому аккаунту. Войдите под нужным пользователем.');
        $clearedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('cleared_at');
        $conversation->load(['participants:id,name,profile_slug,avatar_path,telegram_photo_url,last_seen_at,is_invisible,plan,role,is_admin,account_type,dating_goal,dating_interests', 'district:id,name,user_id']);
        $pageSize = MessageController::HISTORY_PAGE_SIZE;
        $rawMessages = $conversation->messages()
            ->with(['sender:id,name,avatar_path,telegram_photo_url', 'forwardedFrom:id,name,avatar_path,telegram_photo_url', 'replyTo.sender:id,name'])
            ->when($clearedAt, fn ($q) => $q->where('created_at', '>', $clearedAt))
            ->reorder()
            ->orderByDesc('id')
            ->limit($pageSize + 1)
            ->get();
        $hasMoreMessages = $rawMessages->count() > $pageSize;
        $rawMessages = $rawMessages->take($pageSize)->reverse()
            ->values();
        $pinnedModels = $conversation->messages()->with(['sender:id,name,avatar_path,telegram_photo_url', 'forwardedFrom:id,name,avatar_path,telegram_photo_url', 'replyTo.sender:id,name'])->whereNotNull('pinned_at')->orderBy('pinned_at')->get();
        try {
            $avatarUsers = $conversation->participants->all();
            $avatarMessages = $rawMessages->merge($pinnedModels)->all();
            foreach ($avatarMessages as $avatarMessage) {
                if ($avatarMessage->sender) {
                    $avatarUsers[] = $avatarMessage->sender;
                }
                if ($avatarMessage->forwardedFrom) {
                    $avatarUsers[] = $avatarMessage->forwardedFrom;
                }
            }
            \App\Services\UserAvatarService::attachGalleryFallback($avatarUsers);
        } catch (\Throwable) {
        }
        // Невидимка не подтверждает доставку: двойная серая галочка
        // выдала бы отправителю, что получатель в приложении. Пока
        // сообщение не прочитано — у отправителя одна галочка.
        // Прочтение (markRead) показывает синие галочки как обычно.
        if (! $request->user()->isInvisibleActive()) {
            $undelivered = $rawMessages->where('sender_id','!=',$request->user()->id)->whereNull('delivered_at')->pluck('id');
            if($undelivered->isNotEmpty()){
                Message::whereIn('id',$undelivered)->update(['delivered_at'=>now()]);
                $rawMessages->each(function($m) use ($undelivered){ if($undelivered->contains($m->id)) $m->delivered_at = now(); });
                try{ broadcast(new \App\Events\MessageDelivered($conversation->id,$undelivered->toArray(),$request->user()->id))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
            }
        }
        $messages = $rawMessages->map->toArrayPayload();
        $pinned = $pinnedModels->map->toArrayPayload();
        $other = $conversation->participants->firstWhere('id','!=',$request->user()->id);
        $lastSeen = $other && $other->isInvisibleActive() && !$request->user()->isAdmin() ? null : $other?->last_seen_at?->toISOString();
        $isMatch = $other && $conversation->type === 'direct'
            ? \App\Models\DatingMatch::between($request->user()->id, $other->id) !== null
            : false;
        $canInvite = $conversation->type === 'district' && $conversation->district && ((int) $conversation->district->user_id === (int) $request->user()->id || $request->user()->isAdmin());
        $otherOrg = $other ? ($this->organizationMap([(int) $other->id])[(int) $other->id] ?? null) : null;
        $myPinnedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('pinned_at');
        return response()->json([
            'id'=>$conversation->id,
            'type'=>$conversation->type,
            'pin_id'=>$conversation->pin_id,
            'district_id'=>$conversation->district_id,
            'title'=>$conversation->type === 'district' ? ($conversation->district?->name ?? 'Район') : null,
            'can_invite'=>$canInvite,
            'is_pinned'=>$myPinnedAt !== null,
            'other'=>$other ? ['id'=>$other->id,'name'=>$other->name,'profile_slug'=>$other->profile_slug,'avatar_path'=>$other->avatar_path,'telegram_photo_url'=>$other->telegram_photo_url,'avatar_url'=>$other->avatar_url,'last_seen_at'=>$lastSeen,'is_invisible'=>$other->isInvisibleActive(),'is_match'=>$isMatch,'dating_goal'=>$other->dating_goal,'dating_interests'=>$other->dating_interests ?? [],'account_type'=>$other->account_type ?? 'person','is_business'=>($other->account_type ?? 'person') === 'business','is_organization'=>(bool) ($otherOrg['is_organization'] ?? false),'business'=>$otherOrg] : null,
            'participants'=>$conversation->participants->map(fn($p)=> array_merge($p->toArray(), ['avatar_url'=>$p->avatar_url])),
            'messages'=>$messages,
            'messages_has_more'=>$hasMoreMessages,
            'pinned'=>$pinned,
            'pin_limit'=>$request->user()->pinnedMessagesLimit(),
            'wallpaper'=>$conversation->wallpaperPayload(),
            'telegram_share'=>$conversation->type === 'direct'
                ? \App\Services\TelegramUsernameShare::status($conversation, $request->user())
                : ['mine' => false, 'peer' => false, 'exchanged' => false, 'peer_username' => null],
        ]);
    }

    public function store(Request $request)
    {
        $request->validate(['user_id'=>'required|exists:users,id','message'=>'nullable|string|max:2000']);
        $me=$request->user();
        \App\Services\EmailVerificationGate::assertCanWrite($me);
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
                $msg->load('sender:id,name,avatar_path,telegram_photo_url');
                $conv->update(['last_message_at'=>$msg->created_at]);
                try{ broadcast(new \App\Events\MessageSent($msg->load('conversation.participantRows')))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
                try {
                    $push = app(\App\Services\WebPushService::class);
                    if ($push->isConfigured()) $push->sendChatMessage($other, $me, $conv->id, (string) $request->input('message'));
                    try { app(\App\Services\ExpoPushService::class)->sendChatMessage($other, $me, $conv->id, (string) $request->input('message')); } catch (\Throwable) {}
                } catch (\Throwable $e) { \Illuminate\Support\Facades\Log::warning('chat webpush failed: '.$e->getMessage()); }
            }
            $conv->load('participants:id,name,avatar_path,telegram_photo_url');
            try {
                \App\Services\UserAvatarService::attachGalleryFallback($conv->participants->all());
            } catch (\Throwable) {
            }
            return response()->json(['id'=>$conv->id,'existing'=>false,'conversation'=>$conv],201);
        });
    }

    /**
     * Пометить входящие сообщения диалога прочитанными.
     *
     * Сообщения старше cleared_at не трогаем (очищенная история) —
     * тик бейджей считает так же. После обновления сбрасываем кэш
     * тика, иначе следующий опрос вернёт протухшую «1».
     *
     * @param Request $request запрос
     * @param Conversation $conversation диалог
     * @return \Illuminate\Http\JsonResponse
     */
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
        // Квитанции не меняют last_message_at: трогаем диалог, чтобы
        // дельта-синк списка подхватил свежие read_at/delivered_at в превью —
        // иначе тики отправителя протухают до полного рефетча.
        $conversation->touch();
        \Illuminate\Support\Facades\Cache::forget("realtime:badges:{$request->user()->id}");
        try{ broadcast(new \App\Events\MessageRead($conversation->id,$request->user()->id,$ids->toArray()))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        return response()->json(['ok'=>true]);
    }

    /**
     * Подтвердить доставку входящих сообщений диалога.
     *
     * Невидимка квитанцию не шлёт: одиночная галочка у отправителя
     * не должна выдавать, что получатель в приложении. Прочитанные
     * сообщения по-прежнему дают синие галочки (см. markRead).
     *
     * @param Request $request запрос
     * @param Conversation $conversation диалог
     * @return \Illuminate\Http\JsonResponse
     */
    public function markDelivered(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        if ($request->user()->isInvisibleActive()) {
            return response()->json(['ok'=>true,'delivered_ids'=>[]]);
        }
        $clearedAt = $conversation->participantRows()->where('user_id', $request->user()->id)->value('cleared_at');
        $ids = Message::where('conversation_id',$conversation->id)->where('sender_id','!=',$request->user()->id)->whereNull('delivered_at')
            ->when($clearedAt, fn($q) => $q->where('created_at', '>', $clearedAt))
            ->pluck('id');
        if($ids->isNotEmpty()){
            Message::whereIn('id',$ids)->update(['delivered_at'=>now()]);
            $conversation->touch();
            try{ broadcast(new \App\Events\MessageDelivered($conversation->id,$ids->toArray(),$request->user()->id))->toOthers(); }catch(\Throwable $e){ \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage()); }
        }
        return response()->json(['ok'=>true,'delivered_ids'=>$ids]);
    }

    /**
     * Общий фон беседы: смена применяется у всех участников сразу.
     *
     * Картинка грузится в сторедж (а не в IndexedDB), поэтому реально
     * сохраняется и одинакова на всех устройствах собеседников.
     */
    public function updateWallpaper(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id), 403);
        $data = $request->validate([
            'type' => 'required|in:none,preset,color,image',
            'preset' => 'nullable|in:dusk,sunset,ocean,forest,berry,graphite',
            'color' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'image' => 'nullable|image|mimes:jpg,jpeg,png,webp,gif|max:5120',
        ]);
        $type = (string) $data['type'];
        if ($type === 'preset' && empty($data['preset'])) {
            abort(422, 'Выберите пресет');
        }
        if ($type === 'color' && empty($data['color'])) {
            abort(422, 'Выберите цвет');
        }
        if ($type === 'image' && ! $request->hasFile('image')) {
            abort(422, 'Приложите картинку');
        }
        $oldPath = $conversation->wallpaper_image_path;
        $preset = $type === 'preset' ? (string) $data['preset'] : null;
        $color = $type === 'color' ? strtolower((string) $data['color']) : null;
        $imagePath = $type === 'image' ? $oldPath : null;
        if ($type === 'image' && $request->hasFile('image')) {
            $disk = config('filesystems.default') === 's3' && (bool) config('filesystems.disks.s3.bucket')
                ? 's3'
                : 'public';
            $imagePath = \App\Services\ImageOptimizer::storeOptimized(
                $request->file('image'),
                'chat-wallpapers',
                $disk,
                ['maxSide' => 1280, 'quality' => 78],
            );
        }
        $conversation->update([
            'wallpaper_type' => $type === 'none' ? null : $type,
            'wallpaper_preset' => $preset,
            'wallpaper_color' => $color,
            'wallpaper_image_path' => $imagePath,
            'wallpaper_updated_at' => now(),
        ]);
        if ($oldPath && $oldPath !== $imagePath) {
            try {
                $disk = config('filesystems.default') === 's3' && (bool) config('filesystems.disks.s3.bucket')
                    ? 's3'
                    : 'public';
                \Illuminate\Support\Facades\Storage::disk($disk)->delete($oldPath);
            } catch (\Throwable) {
            }
        }
        $conversation->refresh();
        try {
            broadcast(new \App\Events\ConversationWallpaperUpdated($conversation, (int) $request->user()->id))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
        }
        return response()->json(['wallpaper' => $conversation->wallpaperPayload()]);
    }

    /**
     * Выгрузить переписку standalone-HTML файлом.
     *
     * Только свои видимые сообщения (после cleared_at), последние
     * N по лимиту сервиса — старые архивы в файл не тянутся.
     *
     * @param Request $request запрос
     * @param Conversation $conversation диалог
     * @return \Symfony\Component\HttpFoundation\StreamedResponse
     */
    public function exportHtml(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id), 403);

        $me = $request->user();
        $clearedAt = $conversation->participantRows()->where('user_id', $me->id)->value('cleared_at');

        $limit = \App\Services\ChatExportService::MAX_MESSAGES;

        $total = $conversation->messages()
            ->when($clearedAt, fn ($q) => $q->where('created_at', '>', $clearedAt))
            ->count();

        $messages = $conversation->messages()
            ->with(['sender:id,name', 'replyTo.sender:id,name'])
            ->when($clearedAt, fn ($q) => $q->where('created_at', '>', $clearedAt))
            ->reorder()
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();

        $conversation->load(['participants:id,name', 'district:id,name']);

        $service = app(\App\Services\ChatExportService::class);
        $html = $service->buildHtml($conversation, $me, $messages);
        $filename = $service->filename($conversation);

        if ($total > $messages->count()) {
            \Illuminate\Support\Facades\Log::info('chat export truncated', [
                'conversation_id' => $conversation->id,
                'user_id' => $me->id,
                'total' => $total,
            ]);
        }

        return response()->streamDownload(function () use ($html) {
            echo $html;
        }, $filename, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    public function destroy(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id),403);
        $conversation->participantRows()->where('user_id',$request->user()->id)->update(['hidden_at'=>now(),'cleared_at'=>now()]);
        try {
            broadcast(new \App\Events\ConversationRemoved((int) $request->user()->id, [(int) $conversation->id]))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
        }
        return response()->json(['ok'=>true]);
    }

    /**
     * Закрепить диалог у себя: как в Telegram, висит всегда сверху.
     *
     * Закреп личный (поле своей строки участника), у собеседника
     * ничего не меняется. Free — до 3 закрепов, платные — безлимит.
     *
     * @param Request $request запрос
     * @param Conversation $conversation диалог
     * @return \Illuminate\Http\JsonResponse
     */
    public function pin(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id), 403);

        $me = $request->user();
        $row = $conversation->participantRows()->where('user_id', $me->id)->first();
        abort_unless($row, 403);

        if ($row->pinned_at !== null) {
            return response()->json(['ok' => true, 'is_pinned' => true, 'pinned_at' => $row->pinned_at->toISOString()]);
        }

        abort_unless($me->canPinChat($conversation->id), 403, 'На бесплатном тарифе — до 3 закрепов. PRO и выше — без лимита.');

        $row->update(['pinned_at' => now(), 'hidden_at' => null]);

        // Закреп живёт в строке участника, а не диалога: трогаем диалог,
        // чтобы дельта-синк списка подхватил строку на других устройствах.
        $conversation->touch();

        return response()->json(['ok' => true, 'is_pinned' => true, 'pinned_at' => $row->fresh()->pinned_at->toISOString()]);
    }

    /**
     * Открепить диалог у себя: возвращается в общий порядок по времени.
     *
     * @param Request $request запрос
     * @param Conversation $conversation диалог
     * @return \Illuminate\Http\JsonResponse
     */
    public function unpin(Request $request, Conversation $conversation)
    {
        abort_unless($conversation->hasParticipant($request->user()->id), 403);

        $conversation->participantRows()
            ->where('user_id', $request->user()->id)
            ->update(['pinned_at' => null]);

        $conversation->touch();

        return response()->json(['ok' => true, 'is_pinned' => false, 'pinned_at' => null]);
    }

    /**
     * Убрать все диалоги из своего списка навсегда (у собеседников остаются).
     */
    public function clearAll(Request $request)
    {
        $now = now();
        $ids = \App\Models\ConversationParticipant::where('user_id',$request->user()->id)
            ->whereNull('hidden_at')
            ->pluck('conversation_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $cleared = \App\Models\ConversationParticipant::where('user_id',$request->user()->id)
            ->whereNull('hidden_at')
            ->update(['hidden_at'=>$now,'cleared_at'=>$now]);
        if (! empty($ids)) {
            try {
                broadcast(new \App\Events\ConversationRemoved((int) $request->user()->id, $ids))->toOthers();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
            }
        }
        return response()->json(['ok'=>true,'cleared'=>$cleared]);
    }

    /**
     * id диалогов с непрочитанными входящими сообщениями.
     *
     * Гейт тот же, что у бейджей и markRead: сообщения до `cleared_at`
     * не считаем — иначе панель показывала бы «фантомные» непрочитанные,
     * которые невозможно погасить и бейдж висел бы «1».
     *
     * @param int $userId смотрящий пользователь
     * @return \Illuminate\Support\Collection<int, int> id диалогов
     */
    private function unreadConversationIds(int $userId)
    {
        return Message::query()
            ->join('conversation_participants as cp', function ($join) use ($userId) {
                $join->on('cp.conversation_id', '=', 'messages.conversation_id')
                    ->where('cp.user_id', '=', $userId)
                    ->whereNull('cp.hidden_at');
            })
            ->where('messages.sender_id', '!=', $userId)
            ->whereNull('messages.read_at')
            ->where(function ($q) {
                $q->whereNull('cp.cleared_at')
                    ->orWhereColumn('messages.created_at', '>', 'cp.cleared_at');
            })
            ->distinct()
            ->pluck('messages.conversation_id');
    }

    /**
     * Карта организаций для списка id пользователей.
     *
     * Батч-загрузка бизнесов одним запросом (без N+1): для каждого
     * business-аккаунта отдаём legal_form + is_organization + статус.
     * Персоны и бизнес без профиля — null (фронт скрывает бейдж).
     *
     * @param int[] $userIds id пользователей
     * @return array<int, array{legal_form:string,is_organization:bool,is_verified:bool,verification_status:string,name:string}|null>
     */
    private function organizationMap(array $userIds): array
    {
        $ids = array_values(array_unique(array_map('intval', $userIds)));

        if (empty($ids)) {
            return [];
        }

        try {
            $users = User::whereIn('id', $ids)
                ->select('id', 'name', 'account_type')
                ->get()
                ->keyBy('id');

            $businesses = \App\Models\Business::whereIn('user_id', $ids)
                ->orderByDesc('id')
                ->get()
                ->keyBy('user_id');
        } catch (\Throwable) {
            return [];
        }

        $map = [];

        foreach ($ids as $id) {
            $user = $users->get($id);

            if (! $user || ($user->account_type ?? 'person') !== 'business') {
                $map[$id] = null;

                continue;
            }

            $business = $businesses->get($id);

            if (! $business) {
                $map[$id] = [
                    'legal_form' => 'ooo',
                    'is_organization' => true,
                    'is_verified' => false,
                    'verification_status' => 'draft',
                    'name' => (string) ($user->name ?? ''),
                ];

                continue;
            }

            $map[$id] = [
                'legal_form' => (string) ($business->legal_form ?? 'ooo'),
                'is_organization' => $business->isOrganization(),
                'is_verified' => $business->isVerified(),
                'verification_status' => (string) ($business->verification_status ?? 'draft'),
                'name' => (string) ($business->name ?? $user->name ?? ''),
            ];
        }

        return $map;
    }
}
