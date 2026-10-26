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
use App\Models\UserDatabaseNotification;
use App\Services\MonitoringService;
use App\Services\NotificationModuleGate;
use App\Services\RealtimeMode;
use App\Services\UserNotifier;
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
     * Счётчики бейджей одним запросом (источник правды для фронта).
     *
     * В WS-режиме у клиента нет тика /realtime/sync, и раньше он считал
     * непрочитанные по первой странице списка диалогов: диалог с непрочитанным
     * за пределами топ-20 давал фантомную «1», а заход в чат показывал «пусто».
     * Закешированный badges() отдан самостоятельным эндпоинтом, чтобы
     * бейджи работали одинаково в обоих режимах.
     *
     * @param Request $request запрос
     */
    public function badgeCounters(Request $request)
    {
        return response()->json($this->badges($request->user()));
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
            'video_after_id' => 'nullable|integer|min:0',
            'watch_threads' => 'nullable|string|max:200',
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
            'conversations_removed' => $this->removedConversations($user->id, $window),
            'gallery_version' => $this->galleryVersion($user->id),
            'profiles' => app(\App\Services\ProfileFanout::class)->changedProfiles($user->id, $window),
            'open_ids' => $openId ? $this->openConversationIds($openId) : [],
            'typing' => $openId ? $this->typingUsers($openId, $user->id) : [],
            'previews' => $previews,
            // Онлайн-срез участников моих диалогов: в polling-режиме нет
            // presence-канала Echo, и онлайн целиком определялся stale
            // last_seen_at локальных строк (красный «офлайн» у активного
            // собеседника до его следующего сообщения).
            'presence' => $this->freshPresence($user->id),
            'friendships' => $this->freshFriendships($user->id, $window),
            'matches' => $this->freshMatches($user->id, $window),
            'swipe_likes' => $this->freshSwipeLikes($user->id, $window),
            'video_incoming' => app(\App\Services\VideoService::class)->freshIncoming($user->id, $window),
            'video_signals' => app(\App\Services\VideoService::class)->freshSignals($user->id, $window, (int) ($data['video_after_id'] ?? 0)),
            'thread_updates' => $this->freshThreads($data['watch_threads'] ?? null),
            'notifications' => $this->freshNotifications($user, $window),
            'business' => $this->freshBusiness($user, $window),
            'business_pending' => $this->freshBusinessPending($user, $window),
            'wallpapers' => $this->freshWallpapers($convIds, $window),
            'peer' => $openId ? $this->peerState($user, $openId) : null,
            'map' => $this->mapChanges($user->id, $data, $window),
            'receipts' => $this->freshReceipts($user->id, $window),
            'badges' => $this->badges($user),
            // Метка сброса скринлокера: polling-fallback, если сокет-событие
            // screen-lock.reset не дошло. Устройство сравнивает её со своей
            // локальной записью и стирает код, когда метка новее.
            'screen_lock_reset_at' => $user->screen_lock_reset_at?->valueOf() ?? 0,
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
            ->with(['sender:id,name,avatar_path', 'forwardedFrom:id,name,avatar_path,telegram_photo_url', 'replyTo.sender:id,name'])
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
            ->with(['sender:id,name,avatar_path', 'forwardedFrom:id,name,avatar_path,telegram_photo_url', 'replyTo.sender:id,name'])
            ->orderBy('updated_at')
            ->limit(20)
            ->get();

        return $rows->map->toArrayPayload()->all();
    }

    /**
     * Свежие фоны бесед: смена одним собеседником применяется у всех.
     *
     * @param int[] $convIds диалоги
     * @param Carbon|null $since момент прошлого тика
     * @return array<int,array{conversation_id:int,wallpaper:array}>
     */
    private function freshWallpapers(array $convIds, ?Carbon $since): array
    {
        if (empty($convIds) || ! $since) {
            return [];
        }
        return Conversation::whereIn('id', $convIds)
            ->where('wallpaper_updated_at', '>', $since)
            ->limit(20)
            ->get()
            ->map(fn ($conv) => [
                'conversation_id' => (int) $conv->id,
                'wallpaper' => $conv->wallpaperPayload(),
            ])
            ->all();
    }

    /**
     * Диалоги, убранные у себя с прошлого тика (другое устройство/вкладка).
     *
     * Удаление у нас — это hidden_at в своей строке участника, поэтому
     * changedPreviews его не видит. Клиент выкидывает id из списка
     * и из offline-кеша точечно, без полного рефетча.
     *
     * @param int $userId пользователь
     * @param Carbon|null $since момент прошлого тика
     * @return int[]
     */
    private function removedConversations(int $userId, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        return ConversationParticipant::where('user_id', $userId)
            ->whereNotNull('hidden_at')
            ->where('hidden_at', '>', $since)
            ->pluck('conversation_id')
            ->map(fn ($id) => (int) $id)
            ->all();
    }

    /**
     * Версия галереи владельца для инвалидации offline-кеша.
     *
     * max(updated_at) своих фото в ms: выросла — кеш галереи протух
     * (загрузка с другого устройства), клиент ревалидирует список.
     * Сокет-дубль — событие `gallery.changed` в user-канале.
     *
     * @param int $userId владелец галереи
     * @return int 0 когда фото нет
     */
    private function galleryVersion(int $userId): int
    {
        try {
            $max = \App\Models\ProfilePhoto::where('user_id', $userId)->max('updated_at');

            if (! $max) {
                return 0;
            }

            return Carbon::parse((string) $max)->valueOf();
        } catch (\Throwable) {
            return 0;
        }
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
     * Онлайн-срез участников диалогов пользователя (для polling-режима).
     *
     * Тот же критерий онлайн, что у всего приложения: last_seen_at свежее
     * трёх минут (User::isAway). Невидимок скрываем — как presence-канал
     * Echo (участие в канале они не показывают). Кэш 5с: срез нужен
     * каждый тик, а собирать участников одним JOIN-ом — заметная выборка.
     *
     * @param int $userId смотрящий пользователь
     * @return int[] id онлайн-участников, максимум 300
     */
    private function freshPresence(int $userId): array
    {
        $ids = Cache::remember(
            "realtime:presence:{$userId}",
            5,
            function () use ($userId): array {
                $cutoff = now()->subMinutes(3);

                return ConversationParticipant::join('users', 'users.id', '=', 'conversation_participants.user_id')
                    ->whereIn('conversation_participants.conversation_id', $this->myConversationIds($userId))
                    ->where('conversation_participants.user_id', '!=', $userId)
                    ->whereNull('conversation_participants.hidden_at')
                    ->where('users.is_invisible', '=', false)
                    ->where('users.last_seen_at', '>=', $cutoff)
                    ->distinct()
                    ->orderBy('conversation_participants.user_id')
                    ->limit(300)
                    ->pluck('conversation_participants.user_id')
                    ->map(fn ($id) => (int) $id)
                    ->values()
                    ->all();
            },
        );

        return is_array($ids) ? $ids : [];
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
     * Инкогнито скрывает и id: по пингу нельзя открыть анкету.
     */
    private function brief($user, bool $incognito = false): array
    {
        if ($incognito) {
            return [
                'id' => null,
                'name' => 'Тайный поклонник',
                'avatar_url' => null,
                'is_incognito' => true,
            ];
        }

        return [
            'id' => (int) $user->id,
            'name' => (string) $user->name,
            'profile_slug' => $user->profile_slug ?? null,
            'avatar_url' => $user->avatar_url,
            'is_incognito' => false,
        ];
    }

    /**
     * Свежие треды комментариев для открытых веток.
     *
     * Клиент шлёт watch_threads "pin:5:123,flow:9:45" (вид:id:последний
     * известный id, максимум 5 веток) — возвращаем только те, где есть
     * новее. Видимость не проверяем: пейлоад без содержимого, клиент
     * подтянет список обычным REST с его проверками.
     *
     * @param string|null $raw сырая строка тика
     * @return array<int, array{kind:string,id:int,last_id:int}>
     */
    private function freshThreads(?string $raw): array
    {
        if (! $raw) {
            return [];
        }

        $out = [];
        $seen = [];

        foreach (explode(',', $raw) as $part) {
            $chunks = explode(':', trim($part));

            if (count($chunks) !== 3) {
                continue;
            }

            [$kind, $id, $known] = $chunks;
            $id = (int) $id;
            $known = (int) $known;

            if (! in_array($kind, ['pin', 'flow', 'district', 'photo'], true) || $id <= 0 || $known < 0) {
                continue;
            }

            $key = "$kind:$id";

            if (isset($seen[$key]) || count($out) >= 5) {
                continue;
            }

            $seen[$key] = true;
            $lastId = $this->threadLastId($kind, $id);

            if ($lastId > $known) {
                $out[] = ['kind' => $kind, 'id' => $id, 'last_id' => $lastId];
            }
        }

        return $out;
    }

    /**
     * Максимальный id комментария ветки.
     *
     * @param string $kind вид треда
     * @param int $id id объекта
     * @return int 0 когда пусто
     */
    private function threadLastId(string $kind, int $id): int
    {
        try {
            return match ($kind) {
                'pin' => (int) \App\Models\PinComment::where('pin_id', $id)->max('id'),
                'flow' => (int) \App\Models\FlowPostComment::where('post_id', $id)->max('id'),
                'district' => (int) \App\Models\DistrictPostComment::where('post_id', $id)->max('id'),
                'photo' => (int) \App\Models\ProfilePhotoComment::where('photo_id', $id)->max('id'),
                default => 0,
            };
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * Свежие inbox-уведомления (единый источник тостов и колокольчика).
     *
     * Отдаём только непрочитанные: прочитанные уже лежат в ленте
     * колокольчика и тост по ним не нужен (иначе тост всплывал бы
     * по клику на колокольчик / после «прочитать всё»).
     * Гейт модулей — как в ленте: строки выключенных разделов
     * не едут ни тостом, ни бейджем, иначе в колокольчике висит
     * «1», а открывать нечего.
     *
     * @param \App\Models\User $user получатель
     * @param Carbon|null $since момент прошлого тика
     */
    private function freshNotifications($user, ?Carbon $since): array
    {
        if (! $since) {
            return [];
        }

        $query = UserDatabaseNotification::where('notifiable_type', $user->getMorphClass())
            ->where('notifiable_id', $user->getKey())
            ->whereNull('read_at')
            ->where('updated_at', '>', $since);

        $query = NotificationModuleGate::applyAllowedScope($query, $user);

        // Важно: читаем шифрующей моделью, иначе data приедет конвертом
        // {__enc: ...} и тосты поллера будут пустыми («ваша запись»).
        $rows = $query->orderBy('updated_at')
            ->limit(20)
            ->get();

        return $rows->map(fn ($row) => ['notification' => UserNotifier::serialize($row)])->all();
    }

    /**
     * Свежий статус проверки бизнеса владельца.
     *
     * Кабинет обновляется реактивно без перезагрузки: поллер сравнивает
     * verification_status и разносит user:business.* в шину, тосты
     * дополнительно дублируются inbox-уведомлениями (notifications).
     *
     * @param \App\Models\User $user смотрящий
     * @param Carbon|null $since момент прошлого тика
     * @return array|null кабинетный массив бизнеса
     */
    private function freshBusiness($user, ?Carbon $since): ?array
    {
        if (($user->account_type ?? 'person') !== 'business') {
            return null;
        }

        try {
            $business = \App\Models\Business::where('user_id', $user->id)
                ->orderByDesc('id')
                ->first();

            if (! $business) {
                return null;
            }

            return $business->toCabinetArray();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Свежие заявки бизнеса для staff (админы + модераторы).
     *
     * Очередь модерации обновляется реактивно: новые pending-заявки
     * и смена счётчика прилетают в тике polling и сокетом
     * `business.verification.submitted`.
     *
     * @param \App\Models\User $user смотрящий
     * @param Carbon|null $since момент прошлого тика
     * @return array{count:int,items:array}|null
     */
    private function freshBusinessPending($user, ?Carbon $since): ?array
    {
        try {
            if (! $user->isModerator()) {
                return null;
            }
        } catch (\Throwable) {
            return null;
        }

        try {
            $count = \App\Models\Business::where('verification_status', 'pending')->count();

            $items = [];

            if ($since) {
                $items = \App\Models\Business::where('verification_status', 'pending')
                    ->where('updated_at', '>', $since)
                    ->with('user:id,name,email')
                    ->orderByDesc('updated_at')
                    ->limit(10)
                    ->get()
                    ->map(fn ($business) => $business->toCabinetArray())
                    ->all();
            }

            return ['count' => (int) $count, 'items' => $items];
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Свежее состояние собеседника открытого диалога («в сети» + профиль).
     *
     * Кроме last_seen отдаём имя, аватар, мэтч и цель: шапка открытого
     * диалога и строка сайдбара иначе протухают до полного рефетча
     * (переименование, смена аватара, мэтч в существующем диалоге).
     *
     * @param \App\Models\User $user смотрящий
     * @param int $conversationId диалог
     */
    private function peerState($user, int $conversationId): ?array
    {
        $conv = Conversation::whereKey($conversationId)
            ->with('participants:id,name,avatar_path,telegram_photo_url,last_seen_at,is_invisible,dating_goal')
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

        $isMatch = DatingMatch::where(fn ($q) => $q->where('user_a_id', $user->id)->orWhere('user_b_id', $user->id))
            ->where(fn ($q) => $q->where('user_a_id', $other->id)->orWhere('user_b_id', $other->id))
            ->exists();

        return [
            'conversation_id' => $conv->id,
            'id' => $other->id,
            'name' => (string) $other->name,
            'avatar_url' => $other->avatar_url,
            'last_seen_at' => $lastSeen?->toISOString(),
            'is_online' => $hidden ? false : MonitoringService::isOnline($other->last_seen_at),
            'is_match' => $conv->type === 'direct' && $isMatch,
            'dating_goal' => $other->dating_goal,
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
        $empty = ['upsert' => [], 'deleted' => [], 'counters' => [], 'districts_upsert' => [], 'districts_deleted' => []];

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
            ->with('user:id,name,avatar_path,level,account_type')
            ->orderBy('updated_at')
            ->limit(50)
            ->get();

        $memberDistrictIds = $this->memberDistrictIds($userId);
        $isDistrictVisible = function ($p) use ($userId, $memberDistrictIds): bool {
            $districtId = (int) ($p->district_id ?? 0);
            if ($districtId <= 0) {
                return true;
            }
            if ((int) $p->user_id === (int) $userId) {
                return true;
            }

            return isset($memberDistrictIds[$districtId]);
        };
        $upsert = $upsert->filter($isDistrictVisible)->values();
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
        $empty['districts_upsert'] = $this->liveDistricts($userId, $data, $since);

        return $empty;
    }

    /**
     * Свежие районы в bbox для polling-режима: без этого новый район
     * виден только по сокету или после движения карты (рассинхрон).
     *
     * @param int $userId смотрящий
     * @param array $data параметры тика с bbox
     * @param Carbon|null $since момент прошлого тика
     * @return array публичные карточки районов
     */
    private function liveDistricts(int $userId, array $data, ?Carbon $since): array
    {
        if (!$since) {
            return [];
        }

        try {
            $minLat = min((float) $data['min_lat'], (float) $data['max_lat']);
            $maxLat = max((float) $data['min_lat'], (float) $data['max_lat']);
            $minLng = min((float) $data['min_lng'], (float) $data['max_lng']);
            $maxLng = max((float) $data['min_lng'], (float) $data['max_lng']);

            $rows = \App\Models\District::with('owner:id,name,avatar_path')
                ->withCount('approvedMembers')
                ->whereBetween('center_lat', [$minLat, $maxLat])
                ->whereBetween('center_lng', [$minLng, $maxLng])
                ->where('updated_at', '>', $since)
                ->orderBy('updated_at')
                ->limit(30)
                ->get();

            return $rows->map(fn ($d) => $d->toPublicArray($userId))->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Id районов, где пользователь житель.
     *
     * @param int $userId смотрящий
     * @return array<int,true>
     */
    private function memberDistrictIds(int $userId): array
    {
        try {
            $owned = \App\Models\District::where('user_id', $userId)->pluck('id');
            $member = \App\Models\DistrictMember::where('user_id', $userId)
                ->where('status', \App\Models\DistrictMember::STATUS_APPROVED)
                ->pluck('district_id');
            $map = [];
            foreach ($owned->merge($member)->unique() as $id) {
                $map[(int) $id] = true;
            }

            return $map;
        } catch (\Throwable) {
            return [];
        }
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
            $memberIds = $this->memberDistrictIds($userId);
            $pins = Pin::active()
                ->where('category', 'sos')
                ->where('updated_at', '>', $since)
                ->with('user:id,name,avatar_path,level,account_type')
                ->orderBy('updated_at')
                ->limit(10)
                ->get()
                ->filter(function ($p) use ($userId, $memberIds) {
                    $districtId = (int) ($p->district_id ?? 0);
                    if ($districtId <= 0) {
                        return true;
                    }
                    if ((int) $p->user_id === (int) $userId) {
                        return true;
                    }

                    return isset($memberIds[$districtId]);
                })
                ->values();

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
            $memberIds = $this->memberDistrictIds($userId);
            $pins = Pin::active()
                ->whereIn('id', \App\Models\PinInvite::where('invitee_id', $userId)->select('pin_id'))
                ->where('updated_at', '>', $since)
                ->with('user:id,name,avatar_path,level,account_type')
                ->orderBy('updated_at')
                ->limit(10)
                ->get()
                ->filter(function ($p) use ($userId, $memberIds) {
                    $districtId = (int) ($p->district_id ?? 0);
                    if ($districtId <= 0) {
                        return true;
                    }
                    if ((int) $p->user_id === (int) $userId) {
                        return true;
                    }

                    return isset($memberIds[$districtId]);
                })
                ->values();

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
     * Кэш сбрасывается в markRead, иначе после прочтения тик вернёт
     * протухшую «1».
     *
     * Сообщения старше cleared_at не считаем — паритет со списком
     * диалогов и markRead. Иначе доочистные read_at=NULL дают вечную
     * фантомную «1» после каждого прочтения.
     *
     * Inbox считаем тем же гейтом, что ленту и unread-count: строки
     * выключенных разделов в бейдж не попадают, иначе в колокольчике
     * висит «1», а открывать нечего. Новости app.published считаем
     * отдельно от остального inbox (фронт складывает оба) — без
     * этого одна новость давала бы сразу «2».
     *
     * @param \App\Models\User $user пользователь
     * @return array<string, int> счётчики бейджей
     */
    private function badges($user): array
    {
        $userId = (int) $user->id;
        $isAdmin = $user->isAdmin();
        $morph = $user->getMorphClass();

        return Cache::remember("realtime:badges:{$userId}", 5, function () use ($user, $userId, $isAdmin, $morph) {
            $convIds = $this->myConversationIds($userId);

            $unreadMessages = 0;
            $conversationsUnread = 0;
            if (! empty($convIds)) {
                $unreadQuery = Message::whereIn('conversation_id', $convIds)
                    ->where('sender_id', '!=', $userId)
                    ->whereNull('read_at');

                $clearedMap = ConversationParticipant::where('user_id', $userId)
                    ->whereIn('conversation_id', $convIds)
                    ->whereNotNull('cleared_at')
                    ->pluck('cleared_at', 'conversation_id');

                foreach ($clearedMap as $clearedConvId => $clearedAt) {
                    $cutoff = $clearedAt instanceof Carbon
                        ? $clearedAt
                        : Carbon::parse((string) $clearedAt);
                    $cid = (int) $clearedConvId;

                    $unreadQuery->where(function ($q) use ($cid, $cutoff) {
                        $q->where('conversation_id', '!=', $cid);
                        $q->orWhere('created_at', '>', $cutoff);
                    });
                }

                $unreadMessages = (clone $unreadQuery)->count();
                $conversationsUnread = (clone $unreadQuery)->distinct()->count('conversation_id');
            }

            $pendingFriends = Friendship::where('status', 'pending')
                ->where('addressee_id', $userId)
                ->count();

            $inboxBase = UserDatabaseNotification::where('notifiable_type', $morph)
                ->where('notifiable_id', $userId)
                ->whereNull('read_at');

            $inboxBase = NotificationModuleGate::applyAllowedScope($inboxBase, $user);

            $inboxQuery = clone $inboxBase;

            // friend.requested не считаем: владелец — pending_friends выше,
            // иначе одна заявка удваивается в бейдже колокольчика.
            $inboxUnread = (clone $inboxQuery)
                ->where('type', '!=', 'app.published')
                ->where('type', '!=', 'friend.requested')
                ->count();

            $updates = (clone $inboxQuery)->where('type', 'app.published')->count();

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

            try {
                $staffUser = \App\Models\User::find($userId);

                if ($staffUser && $staffUser->isModerator()) {
                    $badges['business_pending'] = \App\Models\Business::where('verification_status', 'pending')->count();
                }
            } catch (\Throwable) {
            }

            return $badges;
        });
    }
}
