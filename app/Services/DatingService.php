<?php

namespace App\Services;

use App\Models\DatingMatch;
use App\Models\Friendship;
use App\Models\Message;
use App\Models\Conversation;
use App\Models\SwipeAction;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Дейтинг-ядро: свайпы, мэтчи, лента, квоты рандомных чатов.
 */
class DatingService
{
    public const FREE_RANDOM_LIMIT = 3;

    public const PRO_RANDOM_LIMIT = 10;

    public const FREE_FAVORITES_LIMIT = 2;

    public const PRO_FAVORITES_LIMIT = 5;

    public const BUSINESS_FAVORITES_LIMIT = 15;

    public const SWIPE_PHOTOS_LIMIT = 3;

    public const SWIPE_PHOTOS_LIMIT_PRO = 5;

    public const GOALS = ['love', 'flirt', 'friendship', 'chat', 'interests'];

    public const GENDER_PREFS = ['male', 'female', 'all'];

    /**
     * Минимальный возраст для свайпов.
     */
    public const ADULT_AGE = 18;

    /**
     * Проверить, что пользователю есть 18 лет.
     *
     * Приложение доступно без ограничений, но свайпы — строго 18+.
     * Дата рождения отсутствует или возраст меньше — 403 с флагом age_gate.
     *
     * @param User $user
     * @return void
     *
     * @throws HttpResponseException
     */
    public function assertAdult(User $user): void
    {
        $isAdult = false;

        try {
            if ($user->birth_date) {
                $threshold = Carbon::now()->subYears(self::ADULT_AGE)->toDateString();
                $birth = Carbon::parse($user->birth_date)->toDateString();
                $isAdult = $birth <= $threshold;
            }
        } catch (\Throwable) {
            $isAdult = false;
        }

        if (! $isAdult) {
            throw new HttpResponseException(response()->json([
                'message' => 'Свайпы доступны с 18 лет. Подтверди дату рождения.',
                'age_gate' => true,
                'age_gate_reason' => $user->birth_date ? 'underage' : 'missing',
            ], 403));
        }
    }

    /**
     * Лимит рандомных чатов за месяц.
     *
     * @param User $user
     * @return int
     */
    public function limitFor(User $user): int
    {
        if ($user->isAdmin()) {
            return PHP_INT_MAX;
        }

        return $user->isPro() ? self::PRO_RANDOM_LIMIT : self::FREE_RANDOM_LIMIT;
    }

    /**
     * Сбросить месячную квоту при смене месяца.
     *
     * @param User $user
     * @return void
     */
    public function resetQuotaIfNeeded(User $user): void
    {
        $month = Carbon::now()->format('Y-m');

        if ($user->random_chats_month !== $month) {
            $user->forceFill([
                'random_chats_used' => 0,
                'random_chats_month' => $month,
            ])->saveQuietly();
        }
    }

    /**
     * Остаток рандомных чатов.
     *
     * @param User $user
     * @return int
     */
    public function quotaLeft(User $user): int
    {
        if ($user->isAdmin()) {
            return PHP_INT_MAX;
        }

        $this->resetQuotaIfNeeded($user->refresh());

        return max(0, $this->limitFor($user) - (int) $user->random_chats_used);
    }

    /**
     * Состояние квоты для бейджа в UI.
     *
     * @param User $user
     * @return array{limit:int,used:int,left:int,plan:string}
     */
    public function quotaState(User $user): array
    {
        if ($user->isAdmin()) {
            return [
                'limit' => -1,
                'used' => 0,
                'left' => -1,
                'plan' => $user->effectivePlan(),
            ];
        }

        $this->resetQuotaIfNeeded($user->refresh());

        $limit = $this->limitFor($user);
        $used = (int) $user->random_chats_used;

        return [
            'limit' => $limit,
            'used' => $used,
            'left' => max(0, $limit - $used),
            'plan' => $user->effectivePlan(),
        ];
    }

    /**
     * Есть ли мэтч между пользователями.
     *
     * @param int $a
     * @param int $b
     * @return bool
     */
    public function isMatched(int $a, int $b): bool
    {
        if ($a === $b) {
            return false;
        }

        return DatingMatch::between($a, $b) !== null;
    }

    /**
     * Списать одну попытку рандомного чата.
     *
     * Мэтчи и друзья не тратят квоту.
     *
     * @param User $me
     * @param User $other
     * @return void
     *
     * @throws HttpResponseException 402 когда квота исчерпана
     */
    public function tryConsumeRandomQuota(User $me, User $other): void
    {
        if ($me->id === $other->id || $me->isAdmin()) {
            return;
        }

        if ($this->isMatched($me->id, $other->id)) {
            return;
        }

        if (Friendship::areFriends($me->id, $other->id)) {
            return;
        }

        $this->resetQuotaIfNeeded($me->refresh());

        $limit = $this->limitFor($me);
        $used = (int) $me->random_chats_used;

        if ($used >= $limit) {
            throw new HttpResponseException(response()->json([
                'message' => 'Лимит сообщений исчерпан. Мэтчи пишут бесплатно — ставьте лайки, либо оформите PRO.',
                'quota' => $this->quotaState($me->refresh()),
            ], 402));
        }

        $me->forceFill(['random_chats_used' => $used + 1])->saveQuietly();
    }

    /**
     * Лимит избранного (лайкнутые без мэтча) по тарифу.
     *
     * @param User $user
     * @return int
     */
    public function favoritesLimitFor(User $user): int
    {
        if ($user->isAdmin()) {
            return self::BUSINESS_FAVORITES_LIMIT;
        }

        $plan = $user->effectivePlan() ?? 'free';

        if ($plan === 'business') {
            return self::BUSINESS_FAVORITES_LIMIT;
        }

        if ($plan === 'pro') {
            return self::PRO_FAVORITES_LIMIT;
        }

        return self::FREE_FAVORITES_LIMIT;
    }

    /**
     * Id пользователей, с которыми уже есть мэтч.
     *
     * @param User $me
     * @return array<int>
     */
    private function matchedIds(User $me): array
    {
        $a = DatingMatch::where('user_a_id', $me->id)->pluck('user_b_id');
        $b = DatingMatch::where('user_b_id', $me->id)->pluck('user_a_id');

        return $a->merge($b)->map(fn ($id) => (int) $id)->unique()->values()->all();
    }

    /**
     * Число занятых мест в избранном (лайки без мэтча).
     *
     * @param User $me
     * @return int
     */
    public function favoritesCount(User $me): int
    {
        $query = SwipeAction::where('liker_id', $me->id)->where('action', 'like');
        $matched = $this->matchedIds($me);

        if ($matched) {
            $query->whereNotIn('liked_id', $matched);
        }

        return (int) $query->count();
    }

    /**
     * Избранное: лайкнутые без мэтча, свежие сверху.
     *
     * @param User $me
     * @return array{favorites:array<int,array<string,mixed>>,limit:int}
     */
    public function favorites(User $me): array
    {
        $matched = $this->matchedIds($me);
        $query = SwipeAction::where('liker_id', $me->id)->where('action', 'like')->orderByDesc('id')->limit(50);

        if ($matched) {
            $query->whereNotIn('liked_id', $matched);
        }

        $ids = $query->pluck('liked_id')->map(fn ($id) => (int) $id)->all();
        $users = User::whereIn('id', $ids)->get()->keyBy('id');
        $likedMe = SwipeAction::where('liked_id', $me->id)->where('action', 'like')->pluck('liker_id')->map(fn ($id) => (int) $id)->flip();

        $cards = [];

        foreach ($ids as $id) {
            $candidate = $users->get($id);

            if (! $candidate) {
                continue;
            }

            $cards[] = $this->cardFor($candidate, $me, $this->distanceKm($me, $candidate), false, isset($likedMe[$id]));
        }

        return ['favorites' => $cards, 'limit' => $this->favoritesLimitFor($me)];
    }

    /**
     * Убрать человека из избранного (свой лайк снимается, анкета может вернуться в ленту).
     *
     * @param User $me
     * @param int $otherId
     * @return void
     */
    public function removeFavorite(User $me, int $otherId): void
    {
        SwipeAction::where('liker_id', $me->id)->where('liked_id', $otherId)->delete();
    }

    /**
     * Сбросить просмотренные свайпы пользователя.
     *
     * Удаляет все SwipeAction автора — лента снова покажет всех кандидатов.
     * Мэтчи и чаты не трогает, только история like/pass. Для тестов админа.
     *
     * @param User $me
     * @return int число удалённых записей
     */
    public function resetHistory(User $me): int
    {
        return SwipeAction::where('liker_id', $me->id)->delete();
    }

    /**
     * Записать свайп и при взаимности создать мэтч.
     *
     * При мэтче сразу создаётся общая комната-чат
     * в готовой системе чатов с системным сообщением.
     * Новый лайк сверх лимита избранного отклоняется (422).
     *
     * @param User $me
     * @param int $otherId
     * @param string $action like|pass
     * @return array{matched:bool,match_id:int|null,conversation_id:int|null}
     */
    public function recordAction(User $me, int $otherId, string $action): array
    {
        abort_if($me->id === $otherId, 422, 'Нельзя лайкать себя');

        $other = User::findOrFail($otherId);

        abort_if(! $other->isDiscoverableBy($me), 404);
        abort_if(UserBlock::where('blocker_id', $otherId)->where('blocked_id', $me->id)->exists(), 403);

        if ($action === 'like') {
            $alreadyLiked = SwipeAction::where('liker_id', $me->id)->where('liked_id', $otherId)->where('action', 'like')->exists();

            if (! $alreadyLiked && $this->favoritesCount($me) >= $this->favoritesLimitFor($me)) {
                $limit = $this->favoritesLimitFor($me);
                abort(422, "Избранное переполнено ({$limit}). Убери кого-то из избранного или возьми Pro.");
            }
        }

        DB::transaction(function () use ($me, $otherId, $action) {
            SwipeAction::updateOrCreate(
                ['liker_id' => $me->id, 'liked_id' => $otherId],
                ['action' => $action]
            );
        });

        if ($action !== 'like') {
            return ['matched' => false, 'match_id' => null, 'conversation_id' => null];
        }

        $reciprocal = SwipeAction::where('liker_id', $otherId)
            ->where('liked_id', $me->id)
            ->where('action', 'like')
            ->exists();

        if (! $reciprocal) {
            return ['matched' => false, 'match_id' => null, 'conversation_id' => null];
        }

        [$low, $high] = DatingMatch::orderedPair($me->id, $otherId);

        $match = DatingMatch::firstOrCreate([
            'user_a_id' => $low,
            'user_b_id' => $high,
        ]);

        $conversation = $this->ensureMatchConversation($me->refresh(), $other);

        return ['matched' => true, 'match_id' => $match->id, 'conversation_id' => $conversation->id];
    }

    /**
     * Комната-чат мэтча в готовой системе чатов.
     *
     * Переиспользует существующий direct-чат, иначе создаёт новый
     * с системным сообщением о мэтче. Квоту не тратит.
     *
     * @param User $me
     * @param User $other
     * @return Conversation
     */
    public function ensureMatchConversation(User $me, User $other): Conversation
    {
        $existing = Conversation::findDirect($me->id, $other->id);

        if ($existing) {
            $existing->participantRows()->where('user_id', $me->id)->update(['hidden_at' => null]);
            $existing->participantRows()->where('user_id', $other->id)->update(['hidden_at' => null]);

            return $existing;
        }

        return DB::transaction(function () use ($me, $other) {
            $conv = Conversation::create([
                'type' => 'direct',
                'created_by' => $me->id,
                'last_message_at' => now(),
            ]);

            $conv->participantRows()->createMany([
                ['user_id' => $me->id, 'joined_at' => now()],
                ['user_id' => $other->id, 'joined_at' => now()],
            ]);

            $msg = Message::create([
                'conversation_id' => $conv->id,
                'sender_id' => $me->id,
                'body' => '💞 Это мэтч! Вы понравились друг другу — общайтесь свободно, лимиты здесь не действуют.',
                'type' => 'system',
            ]);

            $msg->load('sender:id,name,avatar_path');
            $conv->update(['last_message_at' => $msg->created_at]);

            try {
                broadcast(new \App\Events\MessageSent($msg->load('conversation.participantRows')))->toOthers();
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
            }

            try {
                $push = app(\App\Services\WebPushService::class);
                if ($push->isConfigured()) {
                    $push->sendChatMessage($other, $me, $conv->id, '💞 У вас новый мэтч! Загляните в чат.');
                }
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('match webpush failed: '.$e->getMessage());
            }

            return $conv;
        });
    }

    /**
     * Лента кандидатов для свайпов.
     *
     * @param User $me
     * @param array{goal?:string,gender?:string,age_min?:int,age_max?:int,radius_km?:int,interests?:string[]} $filters
     * @param int $limit
     * @return array<int, array<string,mixed>>
     */
    public function feed(User $me, array $filters = [], int $limit = 20): array
    {
        $actedIds = SwipeAction::where('liker_id', $me->id)->pluck('liked_id')->all();

        $hiddenIds = User::hiddenFromSearchFor($me);

        $blockedIds = UserBlock::where('blocker_id', $me->id)
            ->pluck('blocked_id')
            ->merge(UserBlock::where('blocked_id', $me->id)->pluck('blocker_id'))
            ->unique()
            ->values()
            ->all();

        $exclude = array_values(array_unique(array_map(
            'intval',
            array_merge([$me->id], $actedIds, $hiddenIds, $blockedIds, [User::GHOST_USER_ID])
        )));

        $genderPref = $filters['gender'] ?? $me->dating_gender_pref ?? 'all';
        $goal = $filters['goal'] ?? null;
        $ageMin = isset($filters['age_min']) ? (int) $filters['age_min'] : null;
        $ageMax = isset($filters['age_max']) ? (int) $filters['age_max'] : null;
        $radiusKm = isset($filters['radius_km']) ? (int) $filters['radius_km'] : null;
        $wantedInterests = $filters['interests'] ?? [];

        $query = User::whereNotIn('id', $exclude)
            ->where('dating_enabled', true);

        if (! $me->isAdmin() && ! User::isGhostSeer($me)) {
            $query->where('is_admin', false);
        }

        if (in_array($genderPref, ['male', 'female'], true)) {
            $query->where('gender', $genderPref);
        }

        if (in_array($goal, self::GOALS, true)) {
            $query->where('dating_goal', $goal);
        }

        if ($ageMin !== null || $ageMax !== null) {
            $min = $ageMin ?? 18;
            $max = $ageMax ?? 99;
            $maxBirth = Carbon::now()->subYears($min)->toDateString();
            $minBirth = Carbon::now()->subYears($max + 1)->toDateString();
            $query->whereNotNull('birth_date');
            $query->where('birth_date', '<=', $maxBirth);
            $query->where('birth_date', '>=', $minBirth);
        } else {
            $adultThreshold = Carbon::now()->subYears(self::ADULT_AGE)->toDateString();
            $query->where(function ($ageQuery) use ($adultThreshold) {
                $ageQuery->whereNull('birth_date')->orWhere('birth_date', '<=', $adultThreshold);
            });
        }

        $candidates = $query
            ->select([
                'id', 'name', 'gender', 'birth_date', 'bio', 'avatar_path',
                'home_city', 'home_lat', 'home_lng', 'last_seen_at',
                'dating_goal', 'dating_interests', 'dating_hide_name', 'dating_hide_age',
                'plan', 'plan_expires_at', 'is_admin', 'role',
            ])
            ->with(['profilePhotos' => fn ($q) => $q->orderBy('sort_order')->limit(self::SWIPE_PHOTOS_LIMIT_PRO)])
            ->orderByDesc('last_seen_at')
            ->limit(60)
            ->get();

        $likedMeIds = SwipeAction::where('liked_id', $me->id)
            ->where('action', 'like')
            ->pluck('liker_id')
            ->flip();

        $matchedIds = DatingMatch::where('user_a_id', $me->id)
            ->orWhere('user_b_id', $me->id)
            ->get()
            ->map(fn ($m) => $m->user_a_id === $me->id ? $m->user_b_id : $m->user_a_id)
            ->flip();

        $cards = [];

        foreach ($candidates as $candidate) {
            if (! empty($wantedInterests)) {
                $have = $candidate->dating_interests ?? [];
                $have = is_array($have) ? $have : [];
                $overlap = array_intersect($wantedInterests, $have);
                if (empty($overlap)) {
                    continue;
                }
            }

            $distance = $this->distanceKm($me, $candidate);

            if ($radiusKm !== null && $radiusKm > 0) {
                if ($distance === null) {
                    continue;
                }
                if ($distance > $radiusKm) {
                    continue;
                }
            }

            $isMatch = isset($matchedIds[$candidate->id]);
            $cards[] = $this->cardFor($candidate, $me, $distance, $isMatch, isset($likedMeIds[$candidate->id]));

            if (count($cards) >= $limit) {
                break;
            }
        }

        return $cards;
    }

    /**
     * Список мэтчей пользователя.
     *
     * @param User $me
     * @return array<int, array<string,mixed>>
     */
    public function matches(User $me): array
    {
        $rows = DatingMatch::where('user_a_id', $me->id)
            ->orWhere('user_b_id', $me->id)
            ->with(['userA:id,name,avatar_path,last_seen_at', 'userB:id,name,avatar_path,last_seen_at'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        $convByOther = $this->directConversationMap($me);

        $cards = [];

        foreach ($rows as $row) {
            $other = $row->otherUser($me->id);
            $cards[] = [
                'match_id' => $row->id,
                'created_at' => $row->created_at,
                'conversation_id' => $convByOther[$other->id] ?? null,
                'user' => [
                    'id' => $other->id,
                    'name' => $other->name,
                    'avatar_url' => $other->avatar_url,
                    'last_seen_at' => $other->last_seen_at?->toISOString(),
                ],
            ];
        }

        return $cards;
    }

    /**
     * Карта собеседник → direct-чат пользователя.
     *
     * @param User $me
     * @return array<int,int>
     */
    private function directConversationMap(User $me): array
    {
        $convs = Conversation::where('type', 'direct')
            ->whereHas('participantRows', fn ($q) => $q->where('user_id', $me->id))
            ->with(['participantRows' => fn ($q) => $q->select('conversation_id', 'user_id')])
            ->get();

        $map = [];

        foreach ($convs as $conv) {
            foreach ($conv->participantRows as $row) {
                $otherId = (int) $row->user_id;
                if ($otherId !== (int) $me->id) {
                    $map[$otherId] = $conv->id;
                }
            }
        }

        return $map;
    }

    /**
     * Публичная карточка кандидата с учётом приватности.
     *
     * @param User $candidate
     * @param User $viewer
     * @param float|null $distanceKm
     * @param bool $isMatch
     * @param bool $likedMe
     * @return array<string,mixed>
     */
    public function cardFor(User $candidate, User $viewer, ?float $distanceKm, bool $isMatch, bool $likedMe): array
    {
        $canSeeReal = $viewer->id === $candidate->id || $viewer->isAdmin() || $isMatch;

        $hideName = (bool) $candidate->dating_hide_name && ! $canSeeReal;
        $hideAge = (bool) $candidate->dating_hide_age && ! $canSeeReal;

        $photos = $candidate->relationLoaded('profilePhotos')
            ? $candidate->profilePhotos
            : $candidate->profilePhotos()->orderBy('sort_order')->limit(self::SWIPE_PHOTOS_LIMIT_PRO)->get();

        $photoUrls = $photos
            ->map(fn ($p) => $p->url ?? null)
            ->filter()
            ->values()
            ->all();

        if (empty($photoUrls) && $candidate->avatar_url) {
            $photoUrls[] = $candidate->avatar_url;
        }

        $isProCandidate = $candidate->isPro();

        $photosLimit = $isProCandidate
            ? self::SWIPE_PHOTOS_LIMIT_PRO
            : self::SWIPE_PHOTOS_LIMIT;

        $photoUrls = array_values(array_slice($photoUrls, 0, $photosLimit));

        return [
            'id' => $candidate->id,
            'name' => $hideName ? 'Аноним' : $candidate->name,
            'is_anonymous' => $hideName,
            'age' => $hideAge ? null : $candidate->age,
            'age_hidden' => $hideAge,
            'gender' => $candidate->gender,
            'bio' => $candidate->bio,
            'avatar_url' => $candidate->avatar_url,
            'photos' => $photoUrls,
            'photos_limit' => $photosLimit,
            'is_pro' => $isProCandidate,
            'city' => $candidate->home_city,
            'distance_km' => $distanceKm !== null ? round($distanceKm, 1) : null,
            'goal' => $candidate->dating_goal,
            'interests' => $candidate->dating_interests ?? [],
            'last_seen_at' => $candidate->last_seen_at?->toISOString(),
            'is_match' => $isMatch,
            'liked_me' => $likedMe,
        ];
    }

    /**
     * Расстояние между пользователями по домашним координатам.
     *
     * @param User $me
     * @param User $candidate
     * @return float|null
     */
    private function distanceKm(User $me, User $candidate): ?float
    {
        if ($me->home_lat === null || $me->home_lng === null) {
            return null;
        }

        if ($candidate->home_lat === null || $candidate->home_lng === null) {
            return null;
        }

        return $this->haversine(
            (float) $me->home_lat,
            (float) $me->home_lng,
            (float) $candidate->home_lat,
            (float) $candidate->home_lng
        );
    }

    /**
     * Формула гаверсинуса.
     *
     * @param float $lat1
     * @param float $lon1
     * @param float $lat2
     * @param float $lon2
     * @return float
     */
    private function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earth = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) * sin($dLat / 2)
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2))
            * sin($dLon / 2) * sin($dLon / 2);

        return 2 * $earth * asin(min(1, sqrt($a)));
    }
}
