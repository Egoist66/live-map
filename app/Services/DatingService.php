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
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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

    /**
     * Лимит радиуса ленты для Free. PRO/Business/Admin — безлимит.
     */
    public const FREE_SWIPE_RADIUS_KM = 10;

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
     * Лимит радиуса ленты по тарифу. Null — безлимит.
     *
     * Free видит фильтр «рядом» только до 10 км,
     * PRO/Business/Admin — любой радиус и всю страну.
     *
     * @param User $user
     * @return int|null
     */
    public function radiusLimitFor(User $user): ?int
    {
        if ($user->isAdmin() || $user->isPro()) {
            return null;
        }

        return self::FREE_SWIPE_RADIUS_KM;
    }

    /**
     * Проверить, что выбранный радиус доступен тарифу.
     *
     * @param User $user
     * @param int|null $radiusKm
     * @return void
     *
     * @throws HttpResponseException 402 когда радиус только для PRO
     */
    public function assertRadiusAllowed(User $user, ?int $radiusKm): void
    {
        if ($radiusKm === null || $radiusKm <= 0) {
            return;
        }

        $limit = $this->radiusLimitFor($user);

        if ($limit === null || $radiusKm <= $limit) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => "Радиус свыше {$limit} км — PRO-функция. Оформите PRO, чтобы листать дальше.",
            'quota' => $this->quotaState($user),
            'radius_limit' => $limit,
        ], 402));
    }

    /**
     * Использован ли одноразовый сброс истории свайпов.
     *
     * @param User $user
     * @return bool
     */
    public function hasUsedSwipeReset(User $user): bool
    {
        $settings = $user->settings ?? [];

        return (bool) ($settings['swipe_reset_used'] ?? false);
    }

    /**
     * Может ли пользователь сбросить историю сейчас.
     *
     * Админ и PRO/Business — безлимитно, Free — один раз.
     *
     * @param User $user
     * @return bool
     */
    public function canResetHistory(User $user): bool
    {
        if ($user->isPro()) {
            return true;
        }

        return ! $this->hasUsedSwipeReset($user);
    }

    /**
     * Состояние квоты для бейджа в UI.
     *
     * План и лимиты — строго по действующему тарифу (effectivePlan):
     * протухший PRO считается как free и по сообщениям, и по сбросу.
     *
     * @param User $user
     * @return array{limit:int,used:int,left:int,plan:string,plan_expires_at:string|null,radius_limit:int|null,can_reset:bool,reset_used:bool}
     */
    public function quotaState(User $user): array
    {
        $radiusLimit = $this->radiusLimitFor($user);
        $resetUsed = $user->isPro() ? false : $this->hasUsedSwipeReset($user);

        $base = [
            'radius_limit' => $radiusLimit,
            'can_reset' => $this->canResetHistory($user),
            'reset_used' => $resetUsed,
            'plan_expires_at' => $user->plan_expires_at?->toISOString(),
        ];

        if ($user->isAdmin()) {
            return array_merge([
                'limit' => -1,
                'used' => 0,
                'left' => -1,
                'plan' => $user->effectivePlan(),
            ], $base);
        }

        $this->resetQuotaIfNeeded($user->refresh());

        $limit = $this->limitFor($user);
        $used = (int) $user->random_chats_used;

        return array_merge([
            'limit' => $limit,
            'used' => $used,
            'left' => max(0, $limit - $used),
            'plan' => $user->effectivePlan(),
        ], $base);
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
        $ids = DatingMatch::where('user_a_id', $me->id)
            ->orWhere('user_b_id', $me->id)
            ->get(['user_a_id', 'user_b_id']);

        $all = [];

        foreach ($ids as $row) {
            $all[] = (int) $row->user_a_id === $me->id ? (int) $row->user_b_id : (int) $row->user_a_id;
        }

        return array_values(array_unique($all));
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
     * @param int $page страница 1-based
     * @param int $perPage размер страницы
     * @return array{favorites:array<int,array<string,mixed>>,limit:int,current_page:int,last_page:int,total:int,has_more:bool}
     */
    public function favorites(User $me, int $page = 1, int $perPage = 20): array
    {
        $matched = $this->matchedIds($me);
        $totalQuery = SwipeAction::where('liker_id', $me->id)->where('action', 'like');

        if ($matched) {
            $totalQuery->whereNotIn('liked_id', $matched);
        }

        $total = (int) (clone $totalQuery)->count();
        $lastPage = max(1, (int) ceil($total / max(1, $perPage)));
        $page = max(1, min($page, $lastPage));
        $query = SwipeAction::where('liker_id', $me->id)->where('action', 'like')->orderByDesc('id');

        if ($matched) {
            $query->whereNotIn('liked_id', $matched);
        }

        $ids = $query->forPage($page, $perPage)->pluck('liked_id')->map(fn ($id) => (int) $id)->all();
        $users = $ids ? User::whereIn('id', $ids)->get()->keyBy('id') : collect();
        $likedMe = SwipeAction::where('liked_id', $me->id)->where('action', 'like')->pluck('liker_id')->map(fn ($id) => (int) $id)->flip();

        $cards = [];

        foreach ($ids as $id) {
            $candidate = $users->get($id);

            if (! $candidate) {
                continue;
            }

            $cards[] = $this->cardFor($candidate, $me, $this->distanceKm($me, $candidate), false, isset($likedMe[$id]));
        }

        return [
            'favorites' => $cards,
            'limit' => $this->favoritesLimitFor($me),
            'current_page' => $page,
            'last_page' => $lastPage,
            'total' => $total,
            'has_more' => $page < $lastPage,
        ];
    }

    /**
     * Кто лайкнул меня: открытые + инкогнито (PRO скрывает себя).
     * Инкогнито без мэтча отдаём анонимно, после мэтча раскрываем.
     *
     * @param User $me
     * @param int $page страница
     * @param int $perPage размер страницы
     * @return array{admirers:array<int,array<string,mixed>>,total:int,incognito_count:int,current_page:int,last_page:int,has_more:bool}
     */
    public function admirers(User $me, int $page = 1, int $perPage = 20): array
    {
        $total = (int) SwipeAction::where('liked_id', $me->id)->where('action', 'like')->count();
        $lastPage = max(1, (int) ceil($total / max(1, $perPage)));
        $page = max(1, min($page, $lastPage));
        $rows = SwipeAction::where('liked_id', $me->id)
            ->where('action', 'like')
            ->orderByDesc('id')
            ->forPage($page, $perPage)
            ->get();

        $matchedFlip = array_flip($this->matchedIds($me));
        $likerIds = $rows->pluck('liker_id')->map(fn ($id) => (int) $id)->all();
        $users = User::whereIn('id', $likerIds)->get()->keyBy('id');

        $cards = [];
        $incognitoCount = 0;

        foreach ($rows as $row) {
            $candidate = $users->get((int) $row->liker_id);
            if (! $candidate) {
                continue;
            }
            $isMatch = isset($matchedFlip[$candidate->id]);
            $isIncognito = (bool) $row->is_incognito && ! $isMatch && ! $me->isAdmin();
            if ($isIncognito) {
                $incognitoCount++;
            }
            $distance = $this->distanceKm($me, $candidate);
            $card = $this->cardFor($candidate, $me, $distance, $isMatch, true);
            $card['is_incognito'] = $isIncognito;
            $card['created_at'] = $row->created_at?->toISOString();
            if ($isIncognito) {
                $card['id'] = null;
                $card['name'] = 'Тайный поклонник';
                $card['is_anonymous'] = true;
                $card['avatar_url'] = null;
                $card['photos'] = [];
                $card['age'] = null;
                $card['age_hidden'] = true;
                $card['city'] = null;
                $card['distance_km'] = null;
                $card['bio'] = null;
                $card['about'] = null;
                $card['goal'] = null;
                $card['custom_goal'] = null;
                $card['interests'] = [];
                $card['last_seen_at'] = null;
            }
            $cards[] = $card;
        }

        return [
            'admirers' => $cards,
            'total' => $total,
            'incognito_count' => $incognitoCount,
            'current_page' => $page,
            'last_page' => $lastPage,
            'has_more' => $page < $lastPage,
        ];
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
     * Мэтчи и чаты не трогает, только история like/pass.
     * Админ и PRO/Business — безлимитно, Free — один раз.
     *
     * @param User $me
     * @return int число удалённых записей
     *
     * @throws HttpResponseException 403 когда одноразовый сброс уже использован
     */
    public function resetHistory(User $me): int
    {
        $fresh = $me->refresh();

        $unlimited = $fresh->isPro();

        if (! $unlimited && $this->hasUsedSwipeReset($fresh)) {
            throw new HttpResponseException(response()->json([
                'message' => 'Ты уже использовал(а) одноразовый сброс. Дальше — PRO без ограничений.',
                'quota' => $this->quotaState($fresh),
            ], 403));
        }

        $deleted = SwipeAction::where('liker_id', $me->id)->delete();

        if (! $unlimited) {
            $settings = $fresh->settings ?? [];
            $settings['swipe_reset_used'] = true;
            $fresh->forceFill(['settings' => $settings])->saveQuietly();
        }

        return $deleted;
    }

    /**
     * Записать свайп и при взаимности создать мэтч.
     *
     * Инкогнито-лайк (PRO) скрывает автора в «Кто меня лайкнул» и в колокольчике,
     * но после взаимного мэтча обе анкеты раскрываются.
     * Уведомления уходят только за новые события: повторный like тихий,
     * из двух одновременных взаимных лайков уведомляет только создатель мэтча.
     * Вся запись — в одной транзакции, сайд-эффекты (inbox/broadcast/push) — после коммита.
     *
     * @param User $me
     * @param int $otherId
     * @param string $action like|pass
     * @param bool $incognito скрыть себя (только PRO)
     * @return array{matched:bool,match_id:int|null,conversation_id:int|null,is_incognito:bool}
     */
    public function recordAction(User $me, int $otherId, string $action, bool $incognito = false): array
    {
        abort_if($me->id === $otherId, 422, 'Нельзя лайкать себя');

        $other = User::findOrFail($otherId);

        abort_if(! $other->isDiscoverableBy($me), 404);
        abort_if(UserBlock::where('blocker_id', $otherId)->where('blocked_id', $me->id)->exists(), 403);

        if ($action === 'like' && $incognito && ! $me->canUseIncognitoLike()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Анонимный лайк — PRO-функция. Оформите PRO, чтобы скрывать себя.',
            ], 402));
        }

        if ($action === 'like') {
            $alreadyLiked = SwipeAction::where('liker_id', $me->id)->where('liked_id', $otherId)->where('action', 'like')->exists();

            if (! $alreadyLiked && $this->favoritesCount($me) >= $this->favoritesLimitFor($me)) {
                $limit = $this->favoritesLimitFor($me);
                abort(422, "Избранное переполнено ({$limit}). Убери кого-то из избранного или возьми Pro.");
            }
        }

        $swipePayload = $this->swipePayload($action, $incognito);

        $outcome = DB::transaction(function () use ($me, $other, $otherId, $action, $swipePayload) {
            $row = $this->storeSwipe((int) $me->id, $otherId, $swipePayload);

            $actionChanged = $row->wasRecentlyCreated || $row->wasChanged('action');

            if ($action !== 'like') {
                return ['type' => 'pass', 'withdrewLike' => $actionChanged];
            }

            $reciprocal = SwipeAction::where('liker_id', $otherId)
                ->where('liked_id', $me->id)
                ->where('action', 'like')
                ->exists();

            if (! $reciprocal) {
                return ['type' => 'like', 'isNewLike' => $actionChanged];
            }

            User::whereIn('id', [$me->id, $otherId])->orderBy('id')->lockForUpdate()->get();

            [$low, $high] = DatingMatch::orderedPair($me->id, $otherId);

            try {
                $match = DatingMatch::firstOrCreate([
                    'user_a_id' => $low,
                    'user_b_id' => $high,
                ]);
                $isNewMatch = $match->wasRecentlyCreated;
            } catch (QueryException $e) {
                $match = DatingMatch::where('user_a_id', $low)->where('user_b_id', $high)->firstOrFail();
                $isNewMatch = false;
            }

            $conversation = Conversation::findDirect($me->id, $otherId);

            if (! $conversation) {
                $conversation = $this->matchConversationTx($me, $other);
            }

            return [
                'type' => 'match',
                'match_id' => (int) $match->id,
                'conversation_id' => (int) $conversation->id,
                'isNewMatch' => $isNewMatch,
            ];
        });

        if ($outcome['type'] === 'pass') {
            if ($outcome['withdrewLike']) {
                $this->withdrawLike($me, $other);
            }

            return ['matched' => false, 'match_id' => null, 'conversation_id' => null, 'is_incognito' => false];
        }

        if ($outcome['type'] === 'like') {
            if ($outcome['isNewLike']) {
                $this->notifyLiked($me, $other, $incognito);
            }

            return ['matched' => false, 'match_id' => null, 'conversation_id' => null, 'is_incognito' => $incognito];
        }

        if ($outcome['isNewMatch']) {
            $this->notifyMatched($me->refresh(), $other->refresh(), $outcome['match_id'], $outcome['conversation_id']);
            $this->announceMatchConversation($outcome['conversation_id'], $me, $other);
        }

        return ['matched' => true, 'match_id' => $outcome['match_id'], 'conversation_id' => $outcome['conversation_id'], 'is_incognito' => $incognito];
    }

    /**
     * Пейлоад записи свайпа для updateOrCreate.
     *
     * Колонки is_incognito может не быть на базах, где миграция
     * add_incognito_to_swipe_actions не applied (порядок миграций) —
     * тогда пишем только action, иначе любой свайп давал бы 500.
     *
     * @param string $action like|pass
     * @param bool $incognito запрошенное инкогнито
     * @return array{action:string,is_incognito?:bool}
     */
    private function swipePayload(string $action, bool $incognito): array
    {
        $payload = ['action' => $action];

        $hasIncognito = Schema::hasColumn('swipe_actions', 'is_incognito');

        if ($hasIncognito) {
            $payload['is_incognito'] = $action === 'like' && $incognito;
        }

        return $payload;
    }

    /**
     * Сохранить свайп идемпотентно: одна строка на пару (liker_id, liked_id).
     *
     * Гонка unique ловится QueryException и чинится перечитыванием + save.
     * Если колонки is_incognito нет — повтор без неё, чтобы не падать в 500.
     *
     * @param int $likerId автор свайпа
     * @param int $likedId получатель свайпа
     * @param array{action:string,is_incognito?:bool} $payload
     * @return SwipeAction
     */
    private function storeSwipe(int $likerId, int $likedId, array $payload): SwipeAction
    {
        try {
            return SwipeAction::updateOrCreate(
                ['liker_id' => $likerId, 'liked_id' => $likedId],
                $payload
            );
        } catch (QueryException $e) {
            $existing = SwipeAction::where('liker_id', $likerId)
                ->where('liked_id', $likedId)
                ->first();

            if ($existing === null) {
                $plain = ['action' => $payload['action']];

                return SwipeAction::updateOrCreate(
                    ['liker_id' => $likerId, 'liked_id' => $likedId],
                    $plain
                );
            }

            try {
                $existing->fill($payload);
                $existing->save();
            } catch (QueryException $retry) {
                $existing->fill(['action' => $payload['action']]);
                $existing->save();
            }

            return $existing;
        }
    }

    /**
     * Отозвать лайк: гасит висящее уведомление dating.liked у получателя,
     * чтобы после pass не оставался stale-пинг «тебя лайкнули».
     *
     * @param User $me автор отозванного лайка
     * @param User $other получатель
     * @return void
     */
    private function withdrawLike(User $me, User $other): void
    {
        try {
            UserNotifier::deleteUnread((int) $other->id, 'dating.liked', 'dating-liked:'.$me->id);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('swipe_like withdraw failed: '.$e->getMessage());
        }
    }

    /**
     * Краткий профиль для realtime-уведомлений.
     * Инкогнито скрывает id/имя/аватар: по пингу нельзя открыть анкету,
     * она раскрывается только после взаимного мэтча.
     *
     * @param User $user
     * @param bool $incognito
     * @return array{id:int|null,name:string,avatar_url:string|null,is_incognito:bool}
     */
    private function briefFor(User $user, bool $incognito = false): array
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
            'profile_slug' => $user->profile_slug,
            'avatar_url' => $user->avatar_url,
            'is_incognito' => false,
        ];
    }

    /**
     * Уведомить получателя об одиночном лайке.
     * Пишет в единую inbox-таблицу notifications + realtime + push.
     *
     * @param User $liker
     * @param User $liked
     * @param bool $incognito
     * @return void
     */
    private function notifyLiked(User $liker, User $liked, bool $incognito = false): void
    {
        try {
            PinActivityNotifier::swipeLiked($liker, $liked, $incognito);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('swipe_like activity failed: '.$e->getMessage());
        }
        try {
            broadcast(new \App\Events\SwipeLiked($this->briefFor($liker, $incognito), (int) $liked->id))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('swipe liked broadcast failed: '.$e->getMessage());
        }
    }

    /**
     * Уведомить обоих участников о взаимном мэтче.
     *
     * toOthers: у автора свайпа уже открыта модалка мэтча,
     * повторный тост ему не нужен, а второму устройству и
     * второму человеку уведомление придёт по user-каналам.
     *
     * @param User $me
     * @param User $other
     * @param int $matchId
     * @param int $conversationId
     * @return void
     */
    private function notifyMatched(User $me, User $other, int $matchId, int $conversationId): void
    {
        try {
            PinActivityNotifier::matched($me, $other, $matchId);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('match activity failed: '.$e->getMessage());
        }
        try {
            broadcast(new \App\Events\MatchCreated(
                $matchId,
                $conversationId,
                $this->briefFor($me),
                $this->briefFor($other),
            ))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('match broadcast failed: '.$e->getMessage());
        }
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

        $conv = DB::transaction(fn () => $this->matchConversationTx($me, $other));
        $this->announceMatchConversation((int) $conv->id, $me, $other);

        return $conv;
    }

    /**
     * Чистое создание direct-чата мэтча: только запись в БД, без сайд-эффектов.
     * Вызывать внутри транзакции — broadcast и пуши уходят отдельно после коммита.
     *
     * @param User $me автор мэтча
     * @param User $other второй участник
     * @return Conversation
     */
    private function matchConversationTx(User $me, User $other): Conversation
    {
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

        return $conv;
    }

    /**
     * Анонс системного сообщения мэтча: realtime + пуш второму участнику.
     * Только после коммита, чтобы не уведомлять о чате, который откатится.
     *
     * @param int $conversationId id direct-чата мэтча
     * @param User $me автор мэтча
     * @param User $other второй участник
     * @return void
     */
    private function announceMatchConversation(int $conversationId, User $me, User $other): void
    {
        $msg = Message::where('conversation_id', $conversationId)->latest('id')->first();

        if (! $msg) {
            return;
        }

        $this->broadcastMatchMessage($msg);
        $this->pushMatchMessage($me, $other, $conversationId);
    }

    /**
     * Разослать системное сообщение мэтча по realtime (после коммита,
     * чтобы не уведомлять о чате, который откатится).
     *
     * @param Message $msg системное сообщение мэтча
     * @return void
     */
    private function broadcastMatchMessage(Message $msg): void
    {
        try {
            $msg->loadMissing(['sender:id,name,avatar_path', 'conversation.participantRows']);
            broadcast(new \App\Events\MessageSent($msg))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('reverb broadcast failed: '.$e->getMessage());
        }
    }

    /**
     * Пуши о новом мэтче второму участнику (после коммита).
     *
     * @param User $me автор мэтча
     * @param User $other второй участник
     * @param int $conversationId id direct-чата мэтча
     * @return void
     */
    private function pushMatchMessage(User $me, User $other, int $conversationId): void
    {
        try {
            $push = app(\App\Services\WebPushService::class);
            if ($push->isConfigured()) {
                $push->sendChatMessage($other, $me, $conversationId, '💞 У вас новый мэтч! Загляните в чат.');
            }
            try { app(\App\Services\ExpoPushService::class)->sendChatMessage($other, $me, $conversationId, '💞 У вас новый мэтч! Загляните в чат.'); } catch (\Throwable) {}
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('match webpush failed: '.$e->getMessage());
        }
    }

    /**
     * Лента кандидатов для свайпов.
     *
     * По умолчанию — без geo-ограничений: видны все люди в системе,
     * независимо от расстояния. Фильтр «рядом» (radius_km) опционален
     * и упирается в тариф: Free — до 10 км, PRO — безлимит.
     * Для бесконечной колоды фронт шлёт exclude_ids уже виденных,
     * бэк их исключает — дублей нет без сброса истории.
     *
     * @param User $me
     * @param array{goal?:string,gender?:string,age_min?:int,age_max?:int,radius_km?:int,interests?:string[],exclude_ids?:int[]} $filters
     * @param int $limit
     * @return array<int, array<string,mixed>>
     */
    public function feed(User $me, array $filters = [], int $limit = 20): array
    {
        $radiusKm = isset($filters['radius_km']) ? (int) $filters['radius_km'] : null;
        $this->assertRadiusAllowed($me, $radiusKm);

        $actedIds = SwipeAction::where('liker_id', $me->id)->pluck('liked_id')->all();

        $hiddenIds = User::hiddenFromSearchFor($me);

        $blockedIds = UserBlock::where('blocker_id', $me->id)
            ->pluck('blocked_id')
            ->merge(UserBlock::where('blocked_id', $me->id)->pluck('blocker_id'))
            ->unique()
            ->values()
            ->all();

        $extraExclude = isset($filters['exclude_ids']) && is_array($filters['exclude_ids'])
            ? array_map('intval', array_slice($filters['exclude_ids'], 0, 200))
            : [];

        $exclude = array_values(array_unique(array_map(
            'intval',
            array_merge([$me->id], $actedIds, $hiddenIds, $blockedIds, $extraExclude, [User::GHOST_USER_ID])
        )));

        $genderPref = $filters['gender'] ?? $me->dating_gender_pref ?? 'all';
        $goal = $filters['goal'] ?? null;
        $ageMin = isset($filters['age_min']) ? (int) $filters['age_min'] : null;
        $ageMax = isset($filters['age_max']) ? (int) $filters['age_max'] : null;

        // Перевёрнутый диапазон «от–до» нормализуем, иначе лента всегда пуста.
        if ($ageMin !== null && $ageMax !== null && $ageMin > $ageMax) {
            [$ageMin, $ageMax] = [$ageMax, $ageMin];
        }

        $wantedInterests = $filters['interests'] ?? [];

        // PHP-фильтры (радиус, интересы) режут выборку после БД,
        // поэтому при них берём пул кандидатов шире.
        $hasPhpFilters = ($radiusKm !== null && $radiusKm > 0) || ! empty($wantedInterests);
        $poolLimit = $hasPhpFilters ? 200 : 60;

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
                'id', 'name', 'profile_slug', 'gender', 'birth_date', 'bio', 'avatar_path',
                'home_city', 'home_lat', 'home_lng', 'last_seen_at',
                'dating_goal', 'dating_custom_goal', 'dating_about', 'dating_interests', 'dating_hide_name', 'dating_hide_age', 'dating_hide_distance',
                'plan', 'plan_expires_at', 'is_admin', 'role',
            ])
            ->with(['profilePhotos' => fn ($q) => $q->orderBy('sort_order')->limit(self::SWIPE_PHOTOS_LIMIT_PRO)])
            ->orderByDesc('last_seen_at')
            ->limit($poolLimit)
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
     * Активные сейчас в ULove: онлайн-пользователи для таба «Активные».
     *
     * Показывает тех, кто в сети (last_seen_at в пределах онлайн-порога),
     * без geo-ограничений. Каждому прикладывается can_message_reason:
     * написать можно, если человек не запретил (приватность/блоки).
     *
     * @param User $me
     * @param int $limit
     * @param int $page страница 1-based
     * @return array{active:array<int,array<string,mixed>>,current_page:int,last_page:int,total:int,has_more:bool}
     */
    public function active(User $me, int $limit = 20, int $page = 1): array
    {
        $threshold = MonitoringService::onlineThreshold();

        $hiddenIds = User::hiddenFromSearchFor($me);

        $blockedIds = UserBlock::where('blocker_id', $me->id)
            ->pluck('blocked_id')
            ->merge(UserBlock::where('blocked_id', $me->id)->pluck('blocker_id'))
            ->unique()
            ->values()
            ->all();

        $exclude = array_values(array_unique(array_map(
            'intval',
            array_merge([$me->id], $hiddenIds, $blockedIds, [User::GHOST_USER_ID])
        )));

        $adultThreshold = Carbon::now()->subYears(self::ADULT_AGE)->toDateString();

        $baseQuery = User::whereNotIn('id', $exclude)
            ->where('dating_enabled', true)
            ->where('last_seen_at', '>=', $threshold)
            ->where(function ($ageQuery) use ($adultThreshold) {
                $ageQuery->whereNull('birth_date')->orWhere('birth_date', '<=', $adultThreshold);
            })
            ->when(! $me->isAdmin() && ! User::isGhostSeer($me), function ($query) {
                $query->where('is_admin', false);
            });

        $total = (int) (clone $baseQuery)->count();
        $perPage = max(1, $limit);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $lastPage));

        $candidates = (clone $baseQuery)
            ->select([
                'id', 'name', 'profile_slug', 'gender', 'birth_date', 'bio', 'avatar_path',
                'home_city', 'home_lat', 'home_lng', 'last_seen_at',
                'dating_goal', 'dating_custom_goal', 'dating_about', 'dating_interests', 'dating_hide_name', 'dating_hide_age', 'dating_hide_distance',
                'dating_match_only', 'message_privacy', 'allow_random_messages',
                'plan', 'plan_expires_at', 'is_admin', 'role',
            ])
            ->with(['profilePhotos' => fn ($q) => $q->orderBy('sort_order')->limit(self::SWIPE_PHOTOS_LIMIT_PRO)])
            ->orderByDesc('last_seen_at')
            ->forPage($page, $perPage)
            ->get();

        $likedMeIds = SwipeAction::where('liked_id', $me->id)
            ->where('action', 'like')
            ->pluck('liker_id')
            ->flip();

        $matchedIds = $this->matchedIds($me);
        $matchedFlip = array_flip($matchedIds);

        $result = [];

        foreach ($candidates as $candidate) {
            $distance = $this->distanceKm($me, $candidate);
            $isMatch = isset($matchedFlip[$candidate->id]);
            $card = $this->cardFor($candidate, $me, $distance, $isMatch, isset($likedMeIds[$candidate->id]));

            $card['is_online'] = true;
            $card['can_message'] = $me->canMessageUser($candidate);
            $card['can_message_reason'] = $me->messageBlockReason($candidate);

            $result[] = $card;
        }

        return [
            'active' => $result,
            'current_page' => $page,
            'last_page' => $lastPage,
            'total' => $total,
            'has_more' => $page < $lastPage,
        ];
    }

    /**
     * Список мэтчей пользователя.
     *
     * @param User $me
     * @param int $page страница
     * @param int $perPage размер страницы
     * @return array{matches:array<int,array<string,mixed>>,current_page:int,last_page:int,total:int,has_more:bool}
     */
    public function matches(User $me, int $page = 1, int $perPage = 20): array
    {
        $base = DatingMatch::where('user_a_id', $me->id)->orWhere('user_b_id', $me->id);
        $total = (int) (clone $base)->count();
        $perPage = max(1, $perPage);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $lastPage));
        $rows = (clone $base)
            ->with(['userA:id,name,avatar_path,last_seen_at', 'userB:id,name,avatar_path,last_seen_at'])
            ->orderByDesc('created_at')
            ->forPage($page, $perPage)
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

        return [
            'matches' => $cards,
            'current_page' => $page,
            'last_page' => $lastPage,
            'total' => $total,
            'has_more' => $page < $lastPage,
        ];
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
        $hideDistance = (bool) ($candidate->dating_hide_distance ?? false) && ! $canSeeReal;

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
            'profile_slug' => $hideName ? null : $candidate->profile_slug,
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
            'distance_km' => $hideDistance || $distanceKm === null ? null : round($distanceKm, 1),
            'distance_hidden' => $hideDistance,
            'goal' => $candidate->dating_goal,
            'custom_goal' => $candidate->dating_custom_goal,
            'about' => $candidate->dating_about,
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
