<?php

namespace App\Services;

use App\Events\ProfileUpdated;
use App\Models\Conversation;
use App\Models\DatingMatch;
use App\Models\Friendship;
use App\Models\ProfilePhoto;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Рассылка изменений профиля (аватар/имя) всем, кто показывает его в кеше.
 *
 * Проблема: смена аватара/имени раньше долетала только владельцу
 * (`gallery.changed` в свой канал). У друзей, мэтчей и собеседников
 * закешированная строка диалога держала старый `avatar_url` до нового
 * сообщения — отсюда «протухшие» аватарки в сайдбаре, шапке и мини-чатах.
 *
 * Кому шлём (`recipientIds`): принятые друзья + дейтинг-мэтчи + участники
 * direct-диалогов. Множество кешируется на минуту — состав контактов
 * меняется медленно, а тик polling дёргает резолвер часто.
 *
 * Доставка двойная, как у остального realtime:
 * - сокет: `broadcast(new ProfileUpdated(...))` по чужим `user.{id}`
 *   чанками (лимит каналов на одно событие у провайдера);
 * - polling: `changedProfiles()` зеркалит те же данные полем `profiles`
 *   в RealtimeController::sync (см. useRealtimePoller).
 */
class ProfileFanout
{
    /** TTL кеша множества получателей (сек) */
    private const RECIPIENT_CACHE_TTL = 60;

    /** Каналов на одно broadcast-событие (запас под лимит провайдера) */
    private const CHANNEL_CHUNK = 100;

    /** Потолок получателей в polling-запросе (защита от гигантских аудиторий) */
    private const POLL_RECIPIENT_CAP = 1000;

    /** Максимум свежих профилей за тик */
    private const POLL_LIMIT = 50;

    /**
     * Id пользователей, которым виден профиль.
     *
     * @param int $userId чей профиль
     * @return int[] уникальные id без самого владельца
     */
    public function recipientIds(int $userId): array
    {
        if ($userId <= 0) {
            return [];
        }

        return Cache::remember(
            "profile:fanout:{$userId}",
            self::RECIPIENT_CACHE_TTL,
            fn (): array => $this->resolveRecipientIds($userId),
        );
    }

    /**
     * Разослать изменившийся профиль по чужим user-каналам.
     *
     * @param int $userId чей профиль изменился
     * @param int $version версия (ms epoch); 0 — взять updated_at владельца
     * @param int $galleryVersion версия галереи (0 — не сообщать)
     */
    public function notifyAvatarChanged(int $userId, int $version = 0, int $galleryVersion = 0): void
    {
        if ($userId <= 0) {
            return;
        }

        $recipients = $this->recipientIds($userId);

        if (empty($recipients)) {
            return;
        }

        $user = User::find($userId);

        if (! $user) {
            return;
        }

        $payloadVersion = $version > 0
            ? $version
            : (int) ($user->updated_at?->valueOf() ?? now()->valueOf());

        try {
            foreach (array_chunk($recipients, self::CHANNEL_CHUNK) as $chunk) {
                broadcast(new ProfileUpdated(
                    recipientIds: $chunk,
                    userId: $userId,
                    name: (string) $user->name,
                    avatarUrl: $user->avatar_url,
                    version: $payloadVersion,
                    galleryVersion: $galleryVersion,
                ));
            }
        } catch (\Throwable $e) {
            Log::warning('profile fanout broadcast failed: '.$e->getMessage());
        }
    }

    /**
     * Свежие изменения профилей контактов с момента since (polling-зеркало).
     *
     * Отдаём только пользователей из аудитории с `updated_at > since`,
     * ограничивая аудиторию потолком — иначе тик каждые ~2.5с сканировал бы
     * десятки тысяч id у «звёздных» аккаунтов.
     *
     * @param int $userId смотрящий
     * @param Carbon|null $since момент прошлого тика
     * @return array<int, array{user_id:int,name:string,avatar_url:?string,version:int,gallery_version:int}>
     */
    public function changedProfiles(int $userId, ?Carbon $since): array
    {
        if ($userId <= 0 || ! $since) {
            return [];
        }

        $recipients = $this->recipientIds($userId);

        if (empty($recipients)) {
            return [];
        }

        $recipients = array_slice($recipients, 0, self::POLL_RECIPIENT_CAP);

        $rows = User::whereIn('id', $recipients)
            ->where('updated_at', '>', $since)
            ->orderBy('updated_at')
            ->limit(self::POLL_LIMIT)
            ->get(['id', 'name', 'avatar_path', 'telegram_photo_url', 'updated_at']);

        return $rows->map(fn (User $user) => [
            'user_id' => (int) $user->id,
            'name' => (string) $user->name,
            'avatar_url' => $user->avatar_url,
            'version' => (int) ($user->updated_at?->valueOf() ?? 0),
            'gallery_version' => $this->galleryVersion((int) $user->id),
        ])->all();
    }

    /**
     * Собрать аудиторию профиля (без кеша).
     *
     * @param int $userId чей профиль
     * @return int[]
     */
    private function resolveRecipientIds(int $userId): array
    {
        $ids = [];

        $friends = Friendship::where('status', 'accepted')
            ->where(fn ($q) => $q->where('requester_id', $userId)->orWhere('addressee_id', $userId))
            ->get(['requester_id', 'addressee_id']);

        foreach ($friends as $friend) {
            $ids[] = (int) ((int) $friend->requester_id === $userId
                ? $friend->addressee_id
                : $friend->requester_id);
        }

        $matches = DatingMatch::where(fn ($q) => $q->where('user_a_id', $userId)->orWhere('user_b_id', $userId))
            ->get(['user_a_id', 'user_b_id']);

        foreach ($matches as $match) {
            $ids[] = (int) ((int) $match->user_a_id === $userId
                ? $match->user_b_id
                : $match->user_a_id);
        }

        $conversationIds = Conversation::where('type', 'direct')
            ->whereHas('participants', fn ($q) => $q->where('conversation_participants.user_id', $userId))
            ->pluck('id');

        if ($conversationIds->isNotEmpty()) {
            $peerIds = DB::table('conversation_participants')
                ->whereIn('conversation_id', $conversationIds)
                ->where('user_id', '!=', $userId)
                ->pluck('user_id');

            foreach ($peerIds as $peerId) {
                $ids[] = (int) $peerId;
            }
        }

        $ids = array_filter($ids, fn (int $id) => $id > 0 && $id !== $userId);

        return array_values(array_unique($ids));
    }

    /**
     * Версия галереи владельца (max updated_at фото в ms).
     *
     * @param int $userId владелец
     * @return int 0 когда фото нет
     */
    private function galleryVersion(int $userId): int
    {
        try {
            $max = ProfilePhoto::where('user_id', $userId)->max('updated_at');

            if (! $max) {
                return 0;
            }

            return Carbon::parse((string) $max)->valueOf();
        } catch (\Throwable) {
            return 0;
        }
    }
}
