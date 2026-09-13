<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\DatingMatch;
use App\Models\Friendship;
use App\Models\Message;
use App\Models\Pin;
use App\Models\Report;
use App\Models\SwipeAction;
use App\Services\MonitoringService;
use App\Services\RealtimeMode;
use App\Services\UserNotifier;
use Illuminate\Notifications\DatabaseNotification;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Временный REST-транспорт realtime на период лимита WS-соединений.
 *
 * Клиент в режиме polling дёргает sync() раз в несколько секунд вместо
 * сокетов: новые сообщения, typing-индикаторы, превью диалогов и счётчики.
 */
class RealtimeController extends Controller
{
    /**
     * Текущий режим realtime.
     */
    public function mode()
    {
        return response()->json(['mode' => RealtimeMode::get()]);
    }

    /**
     * Переключить режим realtime (только админ).
     */
    public function setMode(Request $request)
    {
        abort_unless($request->user()->isAdmin(), 403);

        $data = $request->validate(['mode' => 'required|in:socket,polling']);

        return response()->json(['mode' => RealtimeMode::set($data['mode'])]);
    }

    /**
     * Один тик поллинга: всё изменившееся с момента since.
     */
    public function sync(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'since' => 'nullable|integer|min:0',
            'conversation_id' => 'nullable|integer',
            'after_id' => 'nullable|integer|min:0',
            'min_lat' => 'nullable|numeric|between:-90,90',
            'max_lat' => 'nullable|numeric|between:-90,90',
            'min_lng' => 'nullable|numeric|between:-180,180',
            'max_lng' => 'nullable|numeric|between:-180,180',
            'known_ids' => 'nullable|string|max:4000',
        ]);

        $since = empty($data['since']) ? null : Carbon::createFromTimestampMs($data['since']);
        // БД хранит время посекундно, а тики идут каждые 3с: без нахлёста события,
        // попавшие в ту же секунду, терялись бы навсегда. Клиент отсекает дубли.
        $window = $since ? $since->copy()->subSeconds(10) : null;
        $openId = empty($data['conversation_id']) ? null : (int) $data['conversation_id'];
        $afterId = (int) ($data['after_id'] ?? 0);

        $convIds = $this->myConversationIds($user->id);

        if ($openId && ! in_array($openId, $convIds, true)) {
            $openId = null;
        }

        $messages = $this->freshMessages($convIds, $window, $afterId);
        $previews = $this->changedPreviews($user->id, $convIds, $window);

        $freshIds = [];
        foreach ($messages as $message) {
            if (isset($message['id'])) {
                $freshIds[] = (int) $message['id'];
            }
        }

        return response()->json([
            'mode' => RealtimeMode::get(),
            'time' => now()->valueOf(),
            'messages' => $messages,
            'messages_updated' => $this->updatedMessages($convIds, $window, $freshIds),
            'open_ids' => $openId ? $this->openConversationIds($openId) : [],
            'typing' => $openId ? $this->typingUsers($openId, $user->id) : [],
            'previews' => $previews,
            'friendships' => $this->freshFriendships($user->id, $window),
            'matches' => $this->freshMatches($user->id, $window),
            'swipe_likes' => $this->freshSwipeLikes($user->id, $window),
            'notifications' => $this->freshNotifications($user->id, $window),
            'peer' => $openId ? $this->peerState($user, $openId) : null,
            'map' => $this->mapChanges($user->id, $data, $window),
            'receipts' => $this->freshReceipts($user->id, $window),
            'badges' => $this->badges($user),
        ]);
    }

    /**
     * Id диалогов пользователя.
     *
     * @param int $userId пользователь
     * @return int[]
     */
    private function myConversationIds(int $userId): array
    {
        return ConversationParticipant::where('user_id', $userId)
            ->whereNull('hidden_at')
            ->pluck('conversation_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Новые сообщения в диалогах пользователя.
     *
     * @param int[] $convIds диалоги
     * @param Carbon|null $since момент прошлого тика
     * @param int $afterId последний известный id в открытом диалоге
     */
    private function freshMessages(array $convIds, ?Carbon $since, int $afterId): array
    {
        if (empty($convIds)) {
            return [];
        }

        $query = Message::whereIn('conversation_id', $convIds)
            ->with(['sender:id,name,avatar_path', 'replyTo.sender:id,name'])
            ->orderBy('id')
            ->limit(50);

        if ($afterId > 0) {
            $query->where('id', '>', $afterId);
        } elseif ($since) {
            $query->where('created_at', '>', $since);
        } else {
            return [];
        }

        return $query->get()->map->toArrayPayload()->all();
    }

    /**
     * Отредактированные/закреплённые сообщения в окне тика.
     *
     * Правки ставит MessageController::update (edited_at), закрепы —
     * pin/unpin (pinned_at). Квитанции доставки/прочтения едут отдельно
     * через freshReceipts, поэтому их здесь не касаемся.
     *
     * @param int[] $convIds диалоги
     * @param Carbon|null $since момент прошлого тика
     * @param int[] $excludeIds id уже отданных свежих сообщений
     */
    private function updatedMessages(array $convIds, ?Carbon $since, array $excludeIds): array
    {
        if (empty($convIds) || ! $since) {
            return [];
        }

        $rows = Message::whereIn('conversation_id', $convIds)
            ->where(fn ($query) => $query->where('edited_at', '>', $since)->orWhere('pinned_at', '>', $since))
            ->whereNotIn('id', $excludeIds ?: [0])
            ->with(['sender:id,name,avatar_path', 'replyTo.sender:id,name'])
            ->orderBy('updated_at')
            ->limit(20)
            ->get();

        return $rows->map->toArrayPayload()->all();
    }

    /**
     * Хвост id открытого диалога для детекта удалений на клиенте.
     *
     * Удаления жёсткие (без soft deletes) — сервер не знает, что видел
     * клиент, поэтому отдаём срез последних id, а поллер сравнивает
     * с локальными и разносит user:message.deleted по недостающим.
     *
     * @param int $conversationId открытый диалог
     * @return int[]
     */
    private function openConversationIds(int $conversationId): array
    {
        return Message::where('conversation_id', $conversationId)
            ->orderByDesc('id')
            ->limit(100)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Лёгкие превью изменившихся диалогов для сайдбара.
     *
     * @param int $userId пользователь
     * @param int[] $convIds диалоги
     * @param Carbon|null $since момент прошлого тика
     */
    private function changedPreviews(int $userId, array $convIds, ?Carbon $since): array
    {
        if (empty($convIds) || ! $since) {
            return [];
        }

        $convs = Conversation::whereIn('id', $convIds)
            ->with(['messages' => fn ($q) => $q->reorder()->latest('id')->limit(1)])
            ->withCount(['messages as unread_count' => fn ($q) => $q->where('sender_id', '!=', $userId)->whereNull('read_at')])
            ->where('last_message_at', '>', $since)
            ->orderByDesc('last_message_at')
            ->limit(20)
            ->get();

        return $convs->map(function ($conv) {
            $last = $conv->messages->first();

            return [
                'id' => $conv->id,
                'unread_count' => (int) $conv->unread_count,
                'last_message' => $last ? $last->toArrayPayload() : null,
                'last_message_at' => $conv->last_message_at,
            ];
        })->all();
    }

    /**
     * Кто сейчас печатает в диалоге (состояние пишет typing-эндпоинт, TTL 5с).
     *
     * @param int $conversationId диалог
     * @param int $selfId не возвращать себя
     * @return int[]
     */
    private function typingUsers(int $conversationId, int $selfId): array
    {
        $ids = ConversationParticipant::where('conversation_id', $conversationId)
            ->where('user_id', '!=', $selfId)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $typing = [];
        foreach ($ids as $id) {
            $fresh = Cache::get("typing:{$conversationId}:{$id}");
            if ($fresh) {
                $typing[] = $id;
            }
        }

        return $typing;
    }

    /**
     * Изменения дружбы с участием пользователя (заявки, принятия).
     * Формат — как FriendshipUpdated, тосты строятся тем же хендлером.
     *
     * @param int $userId пользователь
     * @param Carbon|null $since момент прошлого тика
     */
    private function freshFriendships(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        $rows = Friendship::where(fn ($q) => $q->where('requester_id', $userId)->orWhere('addressee_id', $userId))
            ->where('updated_at', '>', $since)
            ->with(['requester:id,name,avatar_path', 'addressee:id,name,avatar_path'])
            ->orderBy('updated_at')
            ->limit(20)
            ->get();

        return $rows->map(fn ($f) => ['friendship' => [
            'id' => $f->id,
            'requester_id' => $f->requester_id,
            'addressee_id' => $f->addressee_id,
            'status' => $f->status,
            'requester' => $f->requester,
            'addressee' => $f->addressee,
        ]])->all();
    }

    /**
     * Новые мэтчи пользователя. Формат — как MatchCreated.
     *
     * @param int $userId пользователь
     * @param Carbon|null $since момент прошлого тика
     */
    private function freshMatches(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        $rows = DatingMatch::where(fn ($q) => $q->where('user_a_id', $userId)->orWhere('user_b_id', $userId))
            ->where('created_at', '>', $since)
            ->with(['userA:id,name,avatar_path', 'userB:id,name,avatar_path'])
            ->orderBy('id')
            ->limit(10)
            ->get();

        return $rows->map(function ($m) {
            $conv = Conversation::findDirect($m->user_a_id, $m->user_b_id);

            return [
                'match_id' => $m->id,
                'conversation_id' => $conv?->id,
                'user_a' => $this->brief($m->userA),
                'user_b' => $this->brief($m->userB),
            ];
        })->all();
    }

    /**
     * Новые лайки анкеты. Формат — как SwipeLiked.
     *
     * @param int $userId пользователь
     * @param Carbon|null $since момент прошлого тика
     */
    private function freshSwipeLikes(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        $rows = SwipeAction::where('liked_id', $userId)
            ->where('action', 'like')
            ->where('created_at', '>', $since)
            ->with('liker:id,name,avatar_path')
            ->orderBy('id')
            ->limit(20)
            ->get();

        return $rows->map(function ($s) {
            $liker = $s->liker;
            $incognito = (bool) $s->is_incognito;

            return [
                'id' => $s->id,
                'liker' => $liker ? $this->brief($liker, $incognito) : null,
                'conversation_id' => null,
            ];
        })->all();
    }

    /**
     * Краткий профиль для уведомлений (повторяет DatingService::briefFor).
     */
    private function brief($user, bool $incognito = false): array
    {
        if ($incognito) {
            return [
                'id' => (int) $user->id,
                'name' => 'Тайный поклонник',
                'avatar_url' => null,
                'is_incognito' => true,
            ];
        }

        return [
            'id' => (int) $user->id,
            'name' => (string) $user->name,
            'avatar_url' => $user->avatar_url,
            'is_incognito' => false,
        ];
    }

    /**
     * Свежие inbox-уведомления (единый источник тостов и колокольчика).
     *
     * Отдаём только непрочитанные: прочитанные уже лежат в ленте
     * колокольчика и тост по ним не нужен (иначе тост всплывал бы
     * по клику на колокольчик / после «прочитать всё»).
     *
     * @param int $userId пользователь
     * @param Carbon|null $since момент прошлого тика
     */
    private function freshNotifications(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        $rows = DatabaseNotification::where('notifiable_id', $userId)
            ->whereNull('read_at')
            ->where('updated_at', '>', $since)
            ->orderBy('updated_at')
            ->limit(20)
            ->get();

        return $rows->map(fn ($row) => ['notification' => UserNotifier::serialize($row)])->all();
    }

    /**
     * Свежее состояние собеседника открытого диалога («в сети»).
     *
     * @param \App\Models\User $user смотрящий
     * @param int $conversationId диалог
     */
    private function peerState($user, int $conversationId): ?array
    {
        $conv = Conversation::whereKey($conversationId)
            ->with('participants:id,name,avatar_path,last_seen_at,is_invisible')
            ->first();

        if (! $conv) {
            return null;
        }

        $other = $conv->participants->firstWhere('id', '!=', $user->id);

        if (! $other) {
            return null;
        }

        $hidden = $other->isInvisibleActive() && ! $user->isAdmin();
        $lastSeen = $hidden ? null : $other->last_seen_at;

        return [
            'conversation_id' => $conv->id,
            'id' => $other->id,
            'last_seen_at' => $lastSeen?->toISOString(),
            'is_online' => $hidden ? false : MonitoringService::isOnline($other->last_seen_at),
        ];
    }
    /**
     * Изменения карты: upsert пинов в bbox, пропавшие known_ids, свежие счётчики.
     * Тонкие фильтры видимости — на клиенте (isPinVisibleLocally), как в сокетах.
     *
     * @param int $userId смотрящий
     * @param array $data параметры тика
     * @param Carbon|null $since момент прошлого тика
     */
    private function mapChanges(int $userId, array $data, ?Carbon $since): array
    {
        $empty = ['upsert' => [], 'deleted' => [], 'counters' => []];

        $known = $this->parseIds($data['known_ids'] ?? null);

        if (! empty($known)) {
            $activeIds = Pin::active()
                ->whereIn('id', $known)
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
            $activeLookup = array_flip($activeIds);
            $empty['deleted'] = array_values(array_filter($known, fn ($id) => ! isset($activeLookup[$id])));
            $empty['counters'] = Pin::whereIn('id', $activeIds ?: [0])
                ->get(['id', 'reactions_count', 'comments_count'])
                ->mapWithKeys(fn ($p) => [(int) $p->id => [
                    'reactions_count' => (int) $p->reactions_count,
                    'comments_count' => (int) $p->comments_count,
                ]])
                ->all();
        }

        $hasBbox = isset($data['min_lat'], $data['max_lat'], $data['min_lng'], $data['max_lng']);

        if (! $hasBbox || ! $since) {
            return $empty;
        }

        $upsert = Pin::active()
            ->whereBetween('latitude', [(float) $data['min_lat'], (float) $data['max_lat']])
            ->whereBetween('longitude', [(float) $data['min_lng'], (float) $data['max_lng']])
            ->where('updated_at', '>', $since)
            ->with('user:id,name,avatar_path,level')
            ->orderBy('updated_at')
            ->limit(50)
            ->get();

        $upsertPins = $upsert->map(fn ($p) => $p->toPublicArray($userId))->all();

        $sosLive = $this->liveSosPins($userId, $since);
        $invitedLive = $this->liveInvitedPins($userId, $since);
        $seenIds = [];
        foreach ($upsertPins as $row) {
            $seenIds[(int) ($row['id'] ?? 0)] = true;
        }
        foreach ($sosLive as $row) {
            if (! isset($seenIds[(int) ($row['id'] ?? 0)])) {
                $upsertPins[] = $row;
            }
        }
        foreach ($invitedLive as $row) {
            if (! isset($seenIds[(int) ($row['id'] ?? 0)])) {
                $upsertPins[] = $row;
            }
        }

        $empty['upsert'] = $upsertPins;

        return $empty;
    }

    /**
     * Живые SOS-пины вне зависимости от bbox: экстренный вызов
     * должны увидеть все, а не только те, у кого он во вьюпорте.
     *
     * @param int $userId смотрящий
     * @param Carbon|null $since момент прошлого тика
     * @return array
     */
    private function liveSosPins(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        try {
            $pins = Pin::active()
                ->where('category', 'sos')
                ->where('updated_at', '>', $since)
                ->with('user:id,name,avatar_path,level')
                ->orderBy('updated_at')
                ->limit(10)
                ->get();

            return $pins->map(fn ($p) => $p->toPublicArray($userId))->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Живые приглашённые пины вне зависимости от bbox: приглашение
     * должно долететь даже когда пин далеко за радиусом и вьюпортом.
     *
     * @param int $userId смотрящий
     * @param Carbon|null $since момент прошлого тика
     * @return array
     */
    private function liveInvitedPins(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        try {
            $pins = Pin::active()
                ->whereIn('id', \App\Models\PinInvite::where('invitee_id', $userId)->select('pin_id'))
                ->where('updated_at', '>', $since)
                ->with('user:id,name,avatar_path,level')
                ->orderBy('updated_at')
                ->limit(10)
                ->get();

            return $pins->map(fn ($p) => $p->toPublicArray($userId, true))->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Разобрать csv id из тика.
     *
     * @param string|null $raw сырая строка
     * @return int[]
     */
    private function parseIds(?string $raw): array
    {
        if (! $raw) {
            return [];
        }

        $ids = [];
        foreach (explode(',', $raw) as $part) {
            $id = (int) trim($part);
            if ($id > 0) {
                $ids[] = $id;
            }
            if (count($ids) >= 500) {
                break;
            }
        }

        return array_values(array_unique($ids));
    }

    /**
     * Статусы доставки/прочтения моих сообщений (для отправителя).
     *
     * @param int $userId пользователь
     * @param Carbon|null $since момент прошлого тика
     */
    private function freshReceipts(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        $rows = Message::where('sender_id', $userId)
            ->where('updated_at', '>', $since)
            ->where(fn ($q) => $q->whereNotNull('delivered_at')->orWhereNotNull('read_at'))
            ->orderBy('updated_at')
            ->limit(50)
            ->get(['id', 'conversation_id', 'delivered_at', 'read_at']);

        return $rows->map(fn ($m) => [
            'id' => $m->id,
            'conversation_id' => $m->conversation_id,
            'delivered_at' => $m->delivered_at,
            'read_at' => $m->read_at,
        ])->all();
    }

    /**
     * Счётчики для бейджей одним тиком вместо шести запросов с фронта.
     *
     * Тик идёт каждые ~2.5с с каждого таба — без кэша это шесть
     * тяжёлых count-запросов на пользователя. Кэш 5с: свежести хватает
     * для бейджей, а точные события (сообщения, дружба) едут отдельно.
     *
     * @param \App\Models\User $user пользователь
     */
    private function badges($user): array
    {
        $userId = (int) $user->id;
        $isAdmin = $user->isAdmin();

        return Cache::remember("realtime:badges:{$userId}", 5, function () use ($userId, $isAdmin) {
            $convIds = $this->myConversationIds($userId);

            $unreadMessages = 0;
            $conversationsUnread = 0;
            if (! empty($convIds)) {
                $unreadQuery = Message::whereIn('conversation_id', $convIds)
                    ->where('sender_id', '!=', $userId)
                    ->whereNull('read_at');

                $unreadMessages = (clone $unreadQuery)->count();
                $conversationsUnread = (clone $unreadQuery)->distinct()->count('conversation_id');
            }

            $pendingFriends = Friendship::where('status', 'pending')
                ->where('addressee_id', $userId)
                ->count();

            $inboxUnread = DatabaseNotification::where('notifiable_id', $userId)
                ->whereNull('read_at')
                ->count();
            $updates = DatabaseNotification::where('notifiable_id', $userId)
                ->where('type', 'app.published')
                ->whereNull('read_at')
                ->count();

            $badges = [
                'unread_messages' => $unreadMessages,
                'conversations_unread' => $conversationsUnread,
                'pending_friends' => $pendingFriends,
                'pin_activity' => $inboxUnread,
                'updates' => $updates,
            ];

            if ($isAdmin) {
                $badges['reports_pending'] = Report::where('status', 'pending')->count();
            }

            return $badges;
        });
    }
}
