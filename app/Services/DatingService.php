<?php

namespace App\Services;

use App\Models\DatingMatch;
use App\Models\Friendship;
use App\Models\Message;
use App\Models\Conversation;
use App\Models\ProfilePhoto;
use App\Models\SwipeAction;
use App\Models\User;
use App\Models\UserBlock;
use App\Models\UserDatabaseNotification;
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

    public const FREE_FAVORITES_LIMIT = 3;

    public const PRO_FAVORITES_LIMIT = 5;

    public const BUSINESS_FAVORITES_LIMIT = 15;

    /**
     * Бесплатных суперлайков в день: всем — 1, PRO/Business — 5.
     * Докупаются паками по SUPERLIKE_PACK_SIZE в баланс.
     */
    public const SUPERLIKE_FREE_DAILY = 1;

    public const SUPERLIKE_PRO_DAILY = 5;

    public const SUPERLIKE_PACK_SIZE = 5;

    /**
     * Длительность буста профиля, минут: анкета летит первой в чужих лентах.
     */
    public const BOOST_MINUTES = 30;

    /**
     * Откатов последнего свайпа в день для Free. PRO/Business — безлимит.
     */
    public const UNDO_FREE_DAILY = 1;

    /**
     * Разовые товары ULove для отдельной покупки.
     */
    public const EXTRAS_ITEMS = ['superlike_pack', 'boost'];

    /**
     * В ленте ULove видно до 5 фото всем: анкета держит 5,
     * все 5 листаются в свайпах и без PRO.
     */
    public const SWIPE_PHOTOS_LIMIT = 5;

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
     * Стафф (админ/модератор) и PRO/Premium/Business — безлимитно, Free — один раз.
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
     * Дневной лимит суперлайков по тарифу.
     *
     * @param User $user
     * @return int
     */
    public function superlikeAllowance(User $user): int
    {
        if ($user->isAdmin()) {
            return PHP_INT_MAX;
        }

        return $user->isPro() ? self::SUPERLIKE_PRO_DAILY : self::SUPERLIKE_FREE_DAILY;
    }

    /**
     * Обнулить дневной счётчик суперлайков при смене дня.
     *
     * @param User $user
     * @return void
     */
    public function resetSuperlikesIfNeeded(User $user): void
    {
        $today = Carbon::now()->toDateString();

        $day = $user->superlikes_day instanceof \Carbon\CarbonInterface
            ? $user->superlikes_day->toDateString()
            : (string) ($user->superlikes_day ?? '');

        if ($day !== $today) {
            $user->forceFill([
                'superlikes_used' => 0,
                'superlikes_day' => $today,
            ])->saveQuietly();
        }
    }

    /**
     * Сколько суперлайков доступно: дневные + купленный баланс. -1 — безлимит.
     *
     * @param User $user
     * @return int
     */
    public function superlikesLeft(User $user): int
    {
        if ($user->isAdmin()) {
            return -1;
        }

        $this->resetSuperlikesIfNeeded($user->refresh());

        $freeLeft = max(0, $this->superlikeAllowance($user) - (int) $user->superlikes_used);

        return $freeLeft + (int) $user->superlikes_balance;
    }

    /**
     * Списать один суперлайк: сначала дневные, потом баланс.
     *
     * @param User $user
     * @return void
     *
     * @throws HttpResponseException 402 когда суперлайки кончились
     */
    public function consumeSuperlike(User $user): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $this->resetSuperlikesIfNeeded($user->refresh());

        $used = (int) $user->superlikes_used;
        $allowance = $this->superlikeAllowance($user);

        if ($used < $allowance) {
            $user->forceFill(['superlikes_used' => $used + 1])->saveQuietly();

            return;
        }

        $balance = (int) $user->superlikes_balance;

        if ($balance <= 0) {
            throw new HttpResponseException(response()->json([
                'message' => 'Суперлайки на сегодня кончились. Возвращайся завтра или докупи пак.',
                'quota' => $this->quotaState($user->refresh()),
            ], 402));
        }

        $user->forceFill(['superlikes_balance' => $balance - 1])->saveQuietly();
    }

    /**
     * Обнулить дневной счётчик откатов при смене дня.
     *
     * @param User $user
     * @return void
     */
    public function resetUndosIfNeeded(User $user): void
    {
        $today = Carbon::now()->toDateString();

        $day = $user->undos_day instanceof \Carbon\CarbonInterface
            ? $user->undos_day->toDateString()
            : (string) ($user->undos_day ?? '');

        if ($day !== $today) {
            $user->forceFill([
                'undos_used' => 0,
                'undos_day' => $today,
            ])->saveQuietly();
        }
    }

    /**
     * Сколько откатов последнего свайпа доступно. -1 — безлимит (PRO).
     *
     * @param User $user
     * @return int
     */
    public function undosLeft(User $user): int
    {
        if ($user->isPro()) {
            return -1;
        }

        $this->resetUndosIfNeeded($user->refresh());

        return max(0, self::UNDO_FREE_DAILY - (int) $user->undos_used);
    }

    /**
     * Активен ли буст профиля (анкета летит первой в чужих лентах).
     *
     * @param User $user
     * @return bool
     */
    public function isBoostActive(User $user): bool
    {
        $until = $user->boost_until;

        if (! $until) {
            return false;
        }

        try {
            return Carbon::parse($until)->isFuture();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Состояние разовых экстра-товаров для фронта.
     *
     * @param User $user
     * @return array{superlikes_left:int,superlikes_daily:int,superlike_balance:int,boosts_balance:int,boost_active:bool,boost_until:string|null,undos_left:int,can_undo:bool}
     */
    public function extrasState(User $user): array
    {
        $fresh = $user->refresh();

        $canUndo = SwipeAction::where('liker_id', $fresh->id)
            ->orderByDesc('id')
            ->exists();

        $boostUntil = null;

        try {
            $boostUntil = $fresh->boost_until ? Carbon::parse($fresh->boost_until)->toISOString() : null;
        } catch (\Throwable) {
            $boostUntil = null;
        }

        return [
            'superlikes_left' => $this->superlikesLeft($fresh),
            'superlikes_daily' => $this->superlikeAllowance($fresh),
            'superlike_balance' => (int) $fresh->superlikes_balance,
            'boosts_balance' => (int) $fresh->boosts_balance,
            'boost_active' => $this->isBoostActive($fresh),
            'boost_until' => $boostUntil,
            'undos_left' => $this->undosLeft($fresh),
            'can_undo' => $canUndo,
        ];
    }

    /**
     * Состояние квоты для бейджа в UI.
     *
     * План и лимиты — строго по действующему тарифу (effectivePlan):
     * протухший PRO считается как free и по сообщениям, и по сбросу.
     *
     * @param User $user
     * @return array{limit:int,used:int,left:int,plan:string,plan_expires_at:string|null,radius_limit:int|null,can_reset:bool,reset_used:bool,extras:array}
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
            'extras' => $this->extrasState($user),
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

        if (in_array($plan, User::TOP_PLANS, true)) {
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
     * Избранное: лайкнутые без мэтча, свежие сверху, не больше лимита тарифа.
     *
     * Лайки сверх лимита никуда не деваются: они ждут мэтча
     * (получатель их видит, мэтч срабатывает), просто в избранном
     * показываются только свежие по лимиту (Free — 3, Pro — 5, Premium/Business — 15).
     *
     * @param User $me
     * @param int $page страница 1-based
     * @param int $perPage размер страницы
     * @return array{favorites:array<int,array<string,mixed>>,limit:int,current_page:int,last_page:int,total:int,has_more:bool}
     */
    public function favorites(User $me, int $page = 1, int $perPage = 20): array
    {
        $limit = $this->favoritesLimitFor($me);
        $perPage = max(1, $perPage);

        $matched = $this->matchedIds($me);

        $totalQuery = SwipeAction::where('liker_id', $me->id)
            ->where('action', 'like');

        if ($matched) {
            $totalQuery->whereNotIn('liked_id', $matched);
        }

        $storedTotal = (int) (clone $totalQuery)->count();
        $total = min($storedTotal, $limit);

        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $lastPage));

        $offset = ($page - 1) * $perPage;
        $take = max(0, min($perPage, $total - $offset));

        $ids = [];

        if ($take > 0) {
            $rowsQuery = SwipeAction::where('liker_id', $me->id)
                ->where('action', 'like');

            if (Schema::hasColumn('swipe_actions', 'is_superlike')) {
                $rowsQuery->orderByDesc('is_superlike');
            }

            $rowsQuery->orderByDesc('id');

            if ($matched) {
                $rowsQuery->whereNotIn('liked_id', $matched);
            }

            $ids = $rowsQuery->offset($offset)
                ->limit($take)
                ->pluck('liked_id')
                ->map(fn ($id) => (int) $id)
                ->all();
        }
        $users = $ids ? User::whereIn('id', $ids)->get()->keyBy('id') : collect();

        $this->attachPhotos($users->values());

        $likedMe = SwipeAction::where('liked_id', $me->id)->where('action', 'like')->pluck('liker_id')->map(fn ($id) => (int) $id)->flip();

        $ratings = app(DatingReviewService::class)->summariesFor($ids, $me);

        $cards = [];

        foreach ($ids as $id) {
            $candidate = $users->get($id);

            if (! $candidate) {
                continue;
            }

            $cards[] = $this->cardFor($candidate, $me, $this->distanceKm($me, $candidate), false, isset($likedMe[$id]), $ratings[$id] ?? null);
        }

        return [
            'favorites' => $cards,
            'limit' => $limit,
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

        $this->attachPhotos($users->values());

        $ratings = app(DatingReviewService::class)->summariesFor($likerIds, $me);

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
            $card = $this->cardFor($candidate, $me, $distance, $isMatch, true, $ratings[(int) $candidate->id] ?? null);
            $card['is_incognito'] = $isIncognito;
            $card['is_superlike'] = (bool) ($row->is_superlike ?? false);
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
                $card['rating_avg'] = null;
                $card['rating_count'] = 0;
                $card['rating_hidden'] = true;
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
     * Стафф (админ/модератор, у них всегда Premium) и PRO/Premium/Business — безлимитно, Free — один раз.
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
                'message' => 'Ты уже использовал(а) одноразовый сброс. Дальше — PRO или Premium без ограничений.',
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
     * Откатить последний свайп: вернуть анкету в начало колоды.
     *
     * Откатывается только самый свежий свайп автора (фронт шлёт его user_id
     * для сверки). Лайк гасит своё уведомление; мэтч, созданный этим лайком,
     * растворяется (чат остаётся, бесплатная переписка по нему закрывается).
     * Free — UNDO_FREE_DAILY в день, PRO/Premium/Business — безлимит.
     *
     * @param User $me
     * @param int|null $userId ожидаемый id откатываемого (сверка «последний ли»)
     * @return array{user_id:int,action:string,card:array<string,mixed>}
     *
     * @throws HttpResponseException 422 когда откатывать нечего / не последний, 403 когда дневной лимит исчерпан
     */
    public function undoLastSwipe(User $me, ?int $userId = null): array
    {
        $fresh = $me->refresh();

        $last = SwipeAction::where('liker_id', $fresh->id)
            ->orderByDesc('id')
            ->first();

        if (! $last) {
            throw new HttpResponseException(response()->json([
                'message' => 'Откатывать нечего — свайпов пока не было.',
                'quota' => $this->quotaState($fresh),
            ], 422));
        }

        if ($userId !== null && (int) $last->liked_id !== $userId) {
            throw new HttpResponseException(response()->json([
                'message' => 'Откатить можно только последний свайп.',
                'quota' => $this->quotaState($fresh),
            ], 422));
        }

        if (! $fresh->isPro()) {
            $this->resetUndosIfNeeded($fresh);

            $used = (int) $fresh->undos_used;

            if ($used >= self::UNDO_FREE_DAILY) {
                throw new HttpResponseException(response()->json([
                    'message' => 'Откаты на сегодня кончились. PRO откатывает безлимитно.',
                    'quota' => $this->quotaState($fresh),
                ], 403));
            }

            $fresh->forceFill(['undos_used' => $used + 1])->saveQuietly();
        }

        $otherId = (int) $last->liked_id;
        $wasLike = $last->action === 'like';

        $last->delete();

        if ($wasLike) {
            $other = User::find($otherId);

            if ($other) {
                $this->withdrawLike($fresh, $other);
            }

            $match = DatingMatch::between($fresh->id, $otherId);

            if ($match) {
                $match->delete();
            }
        }

        $other = User::find($otherId);

        abort_if(! $other, 404, 'Анкета больше недоступна');

        $card = $this->cardFor($other, $fresh, $this->distanceKm($fresh, $other), false, false);

        return [
            'user_id' => $otherId,
            'action' => $wasLike ? 'like' : 'pass',
            'card' => $card,
        ];
    }

    /**
     * Включить буст профиля на BOOST_MINUTES: анкета летит первой в чужих лентах.
     *
     * PRO/Premium/Business — один бесплатный буст в календарный месяц,
     * остальные — за купленные кредиты boosts_balance.
     *
     * @param User $me
     * @return array{boost_until:string}
     *
     * @throws HttpResponseException 402 когда бустов нет, 409 когда буст уже активен
     */
    public function activateBoost(User $me): array
    {
        $fresh = $me->refresh();

        if ($this->isBoostActive($fresh)) {
            throw new HttpResponseException(response()->json([
                'message' => 'Буст уже активен — дождись конца.',
                'quota' => $this->quotaState($fresh),
            ], 409));
        }

        if ($fresh->isPro()) {
            $month = Carbon::now()->format('Y-m');

            if (($fresh->boost_month ?? null) !== $month) {
                $fresh->forceFill(['boost_month' => $month])->saveQuietly();

                return $this->startBoost($fresh);
            }
        }

        $balance = (int) $fresh->boosts_balance;

        if ($balance <= 0) {
            throw new HttpResponseException(response()->json([
                'message' => 'Нет доступных бустов. PRO получает один в месяц, остальные докупаются.',
                'quota' => $this->quotaState($fresh),
            ], 402));
        }

        $fresh->forceFill(['boosts_balance' => $balance - 1])->saveQuietly();

        return $this->startBoost($fresh->refresh());
    }

    /**
     * Старт буста: проставить boost_until на BOOST_MINUTES вперёд.
     *
     * @param User $me
     * @return array{boost_until:string}
     */
    private function startBoost(User $me): array
    {
        $until = Carbon::now()->addMinutes(self::BOOST_MINUTES);

        $me->forceFill(['boost_until' => $until])->saveQuietly();

        return ['boost_until' => $until->toISOString()];
    }

    /**
     * Купить разовый экстра-товар ULove.
     *
     * Паки и бусты — отдельная покупка: платёжного шлюза пока нет,
     * поэтому обычным пользователям отвечаем 402 payment_required
     * (как SubscriptionController::renew), ничего не начисляя.
     * Стаффу (админ/модератор) начисляем сразу — для тестов.
     * Дневные лимиты этим не тронуты: Free — 1/день, PRO — 5/день.
     *
     * @param User $me
     * @param string $item superlike_pack|boost
     * @return array{item:string,granted:int,extras:array}
     *
     * @throws HttpResponseException 422 при неизвестном товаре, 402 когда нужна оплата
     */
    public function purchaseExtras(User $me, string $item): array
    {
        if (! in_array($item, self::EXTRAS_ITEMS, true)) {
            throw new HttpResponseException(response()->json([
                'message' => 'Неизвестный товар.',
            ], 422));
        }

        $fresh = $me->refresh();

        if (! $fresh->isModerator()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Пак +5 и бусты — отдельная покупка. Оплата в разработке: напиши в поддержку — после подтверждения оплаты товар начислят вручную.',
                'payment_required' => true,
                'item' => $item,
                'quota' => $this->quotaState($fresh),
            ], 402));
        }

        if ($item === 'superlike_pack') {
            $granted = self::SUPERLIKE_PACK_SIZE;

            $fresh->forceFill([
                'superlikes_balance' => (int) $fresh->superlikes_balance + $granted,
            ])->saveQuietly();
        } else {
            $granted = 1;

            $fresh->forceFill([
                'boosts_balance' => (int) $fresh->boosts_balance + $granted,
            ])->saveQuietly();
        }

        return [
            'item' => $item,
            'granted' => $granted,
            'extras' => $this->extrasState($fresh->refresh()),
        ];
    }

    /**
     * Записать свайп и при взаимности создать мэтч.
     *
     * Лайк пишется всегда, даже когда избранное переполнено:
     * лишние лайки просто не показываются в избранном (там только
     * свежие по лимиту тарифа), но ждут мэтча — получатель видит
     * лайк в «Кто меня лайкнул» и колокольчике, мэтч срабатывает.
     * Суперлайк — усиленный лайк: тратит дневной/купленный запас,
     * выделяется у получателя и поднимает автора в его ленте.
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
     * @param bool $superlike усиленный лайк (только с action=like)
     * @return array{matched:bool,match_id:int|null,conversation_id:int|null,is_incognito:bool,is_superlike:bool}
     */
    public function recordAction(User $me, int $otherId, string $action, bool $incognito = false, bool $superlike = false): array
    {
        abort_if($me->id === $otherId, 422, 'Нельзя лайкать себя');

        if ($action === 'like') {
            EmailVerificationGate::assertCanLike($me->refresh());
        }

        $other = User::findOrFail($otherId);

        abort_if(! $other->isDiscoverableBy($me), 404);
        abort_if(UserBlock::where('blocker_id', $otherId)->where('blocked_id', $me->id)->exists(), 403);

        if ($action === 'like' && $incognito && ! $me->canUseIncognitoLike()) {
            throw new HttpResponseException(response()->json([
                'message' => 'Анонимный лайк — PRO-функция. Оформите PRO, чтобы скрывать себя.',
            ], 402));
        }

        if ($superlike) {
            abort_if($action !== 'like', 422, 'Суперлайк можно отправить только с лайком');
            $this->consumeSuperlike($me);
        }

        $swipePayload = $this->swipePayload($action, $incognito, $superlike);

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

            return ['matched' => false, 'match_id' => null, 'conversation_id' => null, 'is_incognito' => false, 'is_superlike' => false];
        }

        if ($outcome['type'] === 'like') {
            if ($outcome['isNewLike']) {
                $this->notifyLiked($me, $other, $incognito, $superlike);
            } else {
                $this->rebumpLiked($me, $other, $incognito, $superlike);
            }

            return ['matched' => false, 'match_id' => null, 'conversation_id' => null, 'is_incognito' => $incognito, 'is_superlike' => $superlike];
        }

        if ($outcome['isNewMatch']) {
            $this->notifyMatched($me->refresh(), $other->refresh(), $outcome['match_id'], $outcome['conversation_id']);
            $this->announceMatchConversation($outcome['conversation_id'], $me, $other);
        }

        return ['matched' => true, 'match_id' => $outcome['match_id'], 'conversation_id' => $outcome['conversation_id'], 'is_incognito' => $incognito, 'is_superlike' => $superlike];
    }

    /**
     * Пейлоад записи свайпа для updateOrCreate.
     *
     * Колонок is_incognito/is_superlike может не быть на базах, где миграции
     * не applied (порядок миграций) — тогда пишем только action,
     * иначе любой свайп давал бы 500.
     *
     * @param string $action like|pass
     * @param bool $incognito запрошенное инкогнито
     * @param bool $superlike запрошенный суперлайк
     * @return array{action:string,is_incognito?:bool,is_superlike?:bool}
     */
    private function swipePayload(string $action, bool $incognito, bool $superlike = false): array
    {
        $payload = ['action' => $action];

        if (Schema::hasColumn('swipe_actions', 'is_incognito')) {
            $payload['is_incognito'] = $action === 'like' && $incognito;
        }

        if (Schema::hasColumn('swipe_actions', 'is_superlike')) {
            $payload['is_superlike'] = $action === 'like' && $superlike;
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
     * Перелайк уже лайкнутого: допинговать получателя, только если
     * прошлое уведомление уже прочитано (нет висящего непрочитанного).
     *
     * Раньше повторный лайк был полностью тихим — получатель не узнавал
     * ничего ни в приложении, ни в боте, и казалось, что «лайки не
     * доходят». Теперь свежий лайк всегда виден: непрочитанный висит —
     * не спамим повтором, прочитан/удалён — шлём заново как новый.
     *
     * @param User $liker автор лайка
     * @param User $liked получатель
     * @param bool $incognito
     * @param bool $superlike
     * @return void
     */
    private function rebumpLiked(User $liker, User $liked, bool $incognito = false, bool $superlike = false): void
    {
        try {
            $hasUnread = UserDatabaseNotification::where('notifiable_type', $liked->getMorphClass())
                ->where('notifiable_id', $liked->id)
                ->where('type', 'dating.liked')
                ->where('key', 'dating-liked:'.$liker->id)
                ->whereNull('read_at')
                ->exists();

            if ($hasUnread) {
                return;
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('swipe_like rebump check failed: '.$e->getMessage());
        }

        $this->notifyLiked($liker, $liked, $incognito, $superlike);
    }

    /**
     * Уведомить получателя об одиночном лайке.
     * Пишет в единую inbox-таблицу notifications + realtime + push.
     *
     * @param User $liker
     * @param User $liked
     * @param bool $incognito
     * @param bool $superlike
     * @return void
     */
    private function notifyLiked(User $liker, User $liked, bool $incognito = false, bool $superlike = false): void
    {
        try {
            PinActivityNotifier::swipeLiked($liker, $liked, $incognito, $superlike);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('swipe_like activity failed: '.$e->getMessage());
        }
        try {
            broadcast(new \App\Events\SwipeLiked($this->briefFor($liker, $incognito), (int) $liked->id))->toOthers();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('swipe liked broadcast failed: '.$e->getMessage());
        }
        try {
            DatingEmailNotifier::liked($liker, $liked, $incognito, $superlike);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('swipe liked email failed: '.$e->getMessage());
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
            DatingEmailNotifier::matched($me, $other, $matchId);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('match email failed: '.$e->getMessage());
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

        $msg->load('sender:id,name,avatar_path,telegram_photo_url');
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
            $msg->loadMissing(['sender:id,name,avatar_path,telegram_photo_url', 'conversation.participantRows']);
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
     * Пол, который ищем по умолчанию: сохранённый выбор,
     * иначе противоположный своему (мужчина → девушки и наоборот).
     *
     * @param User $me
     * @return string male|female|all
     */
    public function defaultGenderPref(User $me): string
    {
        $saved = $me->dating_gender_pref;

        if (in_array($saved, ['male', 'female'], true)) {
            return $saved;
        }

        $opposite = $this->oppositeGender($me->gender);

        return $opposite ?? 'all';
    }

    /**
     * Противоположный пол для дефолтного фильтра «кого ищешь».
     *
     * @param string|null $gender свой пол
     * @return string|null male|female либо null когда определить нельзя
     */
    private function oppositeGender(?string $gender): ?string
    {
        if ($gender === 'male') {
            return 'female';
        }

        if ($gender === 'female') {
            return 'male';
        }

        return null;
    }

    /**
     * Нормализовать список интересов для сравнения без дублей и регистра.
     *
     * Интересы приходят из разных мест (анкета, фильтры ленты) с разным
     * регистром и пробелами («Кино» vs «кино »), а строгое сравнение
     * array_intersect тогда не видит пересечений — фильтр «по интересам»
     * и скоринг молча режут подходящих людей. Приводим всё к нижнему
     * регистру, тримим, выкидываем пустое и дубли.
     *
     * @param mixed $raw сырой список (array|string|null из JSON-колонки или фильтров)
     * @return string[] нормализованные уникальные интересы
     */
    private function normalizeInterests(mixed $raw): array
    {
        if (is_string($raw)) {
            $raw = [$raw];
        }

        if (! is_array($raw)) {
            return [];
        }

        $clean = [];

        foreach ($raw as $tag) {
            if (! is_string($tag) && ! is_numeric($tag)) {
                continue;
            }

            $tag = mb_strtolower(trim((string) $tag));

            if ($tag === '') {
                continue;
            }

            $clean[] = mb_substr($tag, 0, 40);
        }

        return array_values(array_unique($clean));
    }

    /**
     * Значимые токены тега для нечёткого сравнения интересов.
     *
     * «Ночные клубы» разбиваем на слова и берём длинные (>= 4 букв):
     * короткие («и», «по», «на») — шум, они совпали бы у всех подряд.
     *
     * @param string $tag нормализованный тег
     * @return string[] уникальные токены
     */
    private function interestTokens(string $tag): array
    {
        $parts = preg_split('/[\s\-_\/,;:.!?"«»()\[\]]+/u', $tag) ?: [];

        $tokens = [];

        foreach ($parts as $part) {
            $part = trim((string) $part);

            if (mb_strlen($part) >= 4) {
                $tokens[] = $part;
            }
        }

        return array_values(array_unique($tokens));
    }

    /**
     * Похожесть двух тегов интересов от 0 до 1.
     *
     * 1.0 — точное совпадение («клубы» = «клубы»).
     * 0.7 — один тег входит в другой отдельным словом («клубы»
     * в «ночные клубы», «секс» в «секс знакомства») или есть общий
     * значимый токен. Куски короче 4 букв и вхождения внутри слова
     * не считаем — иначе «бар» сматчится с «барбекю»,
     * а «спорт» с «транспортом».
     * 0 — ничего общего.
     *
     * @param string $a нормализованный тег
     * @param string $b нормализованный тег
     * @return float 0, 0.7 или 1.0
     */
    private function interestsSimilarity(string $a, string $b): float
    {
        if ($a === '' || $b === '') {
            return 0;
        }

        if ($a === $b) {
            return 1.0;
        }

        $shorter = mb_strlen($a) <= mb_strlen($b) ? $a : $b;
        $longer = $shorter === $a ? $b : $a;

        if (mb_strlen($shorter) >= 4 && $this->hasWholeWord($longer, $shorter)) {
            return 0.7;
        }

        $tokensA = $this->interestTokens($a);
        $tokensB = $this->interestTokens($b);

        foreach ($tokensA as $token) {
            if (in_array($token, $tokensB, true)) {
                return 0.7;
            }
        }

        return 0;
    }

    /**
     * Есть ли фраза отдельным словом внутри тега.
     *
     * Границы — начало/конец строки или не-буквы: «спорт»
     * находится в «спорт и музыка», но не в «транспорте».
     *
     * @param string $haystack тег, в котором ищем
     * @param string $needle фраза, которую ищем
     * @return bool true когда вхождение по границам слов
     */
    private function hasWholeWord(string $haystack, string $needle): bool
    {
        $pattern = '/(?<![\p{L}\p{N}_])' . preg_quote($needle, '/') . '(?![\p{L}\p{N}_])/u';

        return preg_match($pattern, $haystack) === 1;
    }

    /**
     * Сопоставить два списка интересов без переиспользования тегов.
     *
     * Каждый тег участвует максимум в одной паре: сначала забираем
     * точные совпадения, потом похожие среди остатков. Поэтому
     * «клубы, музыка» vs «клубы, ночные клубы» даст exact=1, similar=1,
     * а не накрутит similar за один и тот же тег дважды.
     *
     * @param string[] $mine нормализованные интересы зрителя
     * @param string[] $theirs нормализованные интересы кандидата
     * @return array{exact:int, similar:int} число пар каждого типа
     */
    private function matchInterests(array $mine, array $theirs): array
    {
        $freeMine = array_values($mine);
        $freeTheirs = array_values($theirs);

        $exact = 0;

        foreach ($freeMine as $i => $tagMine) {
            $found = array_search($tagMine, $freeTheirs, true);

            if ($found === false) {
                continue;
            }

            $exact++;
            unset($freeMine[$i]);
            unset($freeTheirs[$found]);
        }

        $freeMine = array_values($freeMine);
        $freeTheirs = array_values($freeTheirs);

        $similar = 0;

        foreach ($freeMine as $i => $tagMine) {
            foreach ($freeTheirs as $j => $tagTheirs) {
                $score = $this->interestsSimilarity($tagMine, $tagTheirs);

                if ($score < 0.7) {
                    continue;
                }

                $similar++;
                unset($freeMine[$i]);
                unset($freeTheirs[$j]);
                break;
            }
        }

        return ['exact' => $exact, 'similar' => $similar];
    }

    /**
     * Лента кандидатов для свайпов.
     *
     * В ленте — только совершеннолетние с указанной датой рождения:
     * возраст неизвестен — в свайпах не показываем (строго 18+).
     * По умолчанию — без geo-ограничений: видны все люди в системе,
     * независимо от расстояния. Фильтр «рядом» (radius_km) опционален
     * и упирается в тариф: Free — до 10 км, PRO — безлимит.
     * Пол по умолчанию — сохранённый выбор, иначе противоположный
     * своему (мужчина листает девушек и наоборот).
     * Порядок — умный скоринг релевантности (scoreCandidate),
     * а не просто «кто позже заходил»: взаимные лайки и суперлайки,
     * онлайн, общие интересы и цель, фото и заполненность анкеты,
     * близость, новички и активный буст — плюс лёгкий джиттер,
     * чтобы выдача не была статичной.
     * Интересы сравниваются нечётко (точное + вхождение/общий токен):
     * «клубы» найдёт и «ночные клубы», «секс» — и «секс знакомства».
     * Цель «по интересам» дополнительно требует пересечения
     * со своими интересами из анкеты — подборка строится от неё.
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

        $explicitGender = $filters['gender'] ?? null;
        $genderPref = in_array($explicitGender, ['male', 'female', 'all'], true)
            ? $explicitGender
            : $this->defaultGenderPref($me);
        $goal = $filters['goal'] ?? null;
        $ageMin = isset($filters['age_min']) ? (int) $filters['age_min'] : null;
        $ageMax = isset($filters['age_max']) ? (int) $filters['age_max'] : null;

        // Перевёрнутый диапазон «от–до» нормализуем, иначе лента всегда пуста.
        if ($ageMin !== null && $ageMax !== null && $ageMin > $ageMax) {
            [$ageMin, $ageMax] = [$ageMax, $ageMin];
        }

        $wantedInterests = $this->normalizeInterests($filters['interests'] ?? []);

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
            $query->whereNotNull('birth_date');
            $query->where('birth_date', '<=', $adultThreshold);
        }

        $candidates = $query
            ->select([
                'id', 'name', 'profile_slug', 'gender', 'birth_date', 'bio', 'avatar_path', 'telegram_photo_url',
                'home_city', 'home_lat', 'home_lng', 'last_seen_at', 'created_at', 'boost_until',
                'dating_goal', 'dating_custom_goal', 'dating_about', 'dating_interests', 'dating_hide_name', 'dating_hide_age', 'dating_hide_distance',
                'plan', 'plan_expires_at', 'is_admin', 'role', 'is_invisible',
            ])
            ->orderByDesc('last_seen_at')
            ->limit($poolLimit)
            ->get();

        $candidates = $this->withoutInvisible($candidates, $me);

        $likedMeSuper = $this->superlikeSendersMap($me);

        $matchedIds = DatingMatch::where('user_a_id', $me->id)
            ->orWhere('user_b_id', $me->id)
            ->get()
            ->map(fn ($m) => $m->user_a_id === $me->id ? $m->user_b_id : $m->user_a_id)
            ->flip();

        $myInterests = $this->normalizeInterests($me->dating_interests ?? []);

        $myGoal = $me->dating_goal;

        $matchByMyInterests = $goal === 'interests' && ! empty($myInterests);

        $scored = [];

        foreach ($candidates as $candidate) {
            $have = $this->normalizeInterests($candidate->dating_interests ?? []);

            if (! empty($wantedInterests)) {
                $wanted = $this->matchInterests($wantedInterests, $have);

                if ($wanted['exact'] === 0 && $wanted['similar'] === 0) {
                    continue;
                }
            }

            if ($matchByMyInterests) {
                $mutual = $this->matchInterests($myInterests, $have);

                if ($mutual['exact'] === 0 && $mutual['similar'] === 0) {
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

            $score = $this->scoreCandidate($candidate, $distance, $likedMeSuper, $myInterests, $myGoal);

            $scored[] = [
                'candidate' => $candidate,
                'distance' => $distance,
                'isMatch' => $isMatch,
                'score' => $score,
            ];
        }

        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']);

        $top = array_slice($scored, 0, max(1, $limit));

        $topCandidates = collect($top)->map(fn ($row) => $row['candidate']);

        $this->attachPhotos($topCandidates);

        $topIds = $topCandidates->map(fn ($candidate) => (int) $candidate->id)->all();
        $ratings = app(DatingReviewService::class)->summariesFor($topIds, $me);

        $cards = [];

        foreach ($top as $row) {
            $candidate = $row['candidate'];

            $likedMe = isset($likedMeSuper[$candidate->id]);

            $card = $this->cardFor($candidate, $me, $row['distance'], $row['isMatch'], $likedMe, $ratings[(int) $candidate->id] ?? null);

            $card['is_superlike'] = $likedMe && ($likedMeSuper[$candidate->id] ?? false);
            $card['is_boosted'] = $this->isBoostActive($candidate);
            $card['score'] = $row['score'];

            $cards[] = $card;
        }

        return $cards;
    }

    /**
     * Карта «кто лайкнул меня суперлайком»: liker_id → is_superlike.
     *
     * Колонки может не быть на старых базах — тогда все флаги false.
     *
     * @param User $me
     * @return array<int,bool>
     */
    private function superlikeSendersMap(User $me): array
    {
        $map = [];

        $base = SwipeAction::where('liked_id', $me->id)
            ->where('action', 'like');

        if (! Schema::hasColumn('swipe_actions', 'is_superlike')) {
            $ids = (clone $base)->pluck('liker_id')->all();

            foreach ($ids as $likerId) {
                $map[(int) $likerId] = false;
            }

            return $map;
        }

        $pairs = (clone $base)->pluck('is_superlike', 'liker_id')->all();

        foreach ($pairs as $likerId => $flag) {
            $map[(int) $likerId] = (bool) $flag;
        }

        return $map;
    }

    /**
     * Релевантность кандидата для зрителя: чем выше, тем раньше в ленте.
     *
     * Веса: лайкнул меня +40 (суперлайк +20 сверху), активный буст +120,
     * онлайн <=15 мин +25 (<=1 ч +15, <=суток +8), общие интересы точные +8
     * (похожие +4, потолок +24), совпавшая цель +10, есть фото +8, заполнено «о себе» +4,
     * PRO +4, рядом <=5 км +10 (<=25 км +6, <=100 км +3),
     * новичок (меньше 7 дней) +12, джиттер 0..6 против статичности.
     *
     * @param User $candidate кандидат
     * @param float|null $distanceKm расстояние или null
     * @param array<int,bool> $likedMeSuper кто лайкнул (и супер ли)
     * @param string[] $myInterests интересы зрителя
     * @param string|null $myGoal цель зрителя
     * @return int итоговый вес
     */
    private function scoreCandidate(User $candidate, ?float $distance, array $likedMeSuper, array $myInterests, ?string $myGoal): int
    {
        $score = 0;

        $likedMe = isset($likedMeSuper[$candidate->id]);

        if ($likedMe) {
            $score += 40;
        }

        if ($likedMe && ($likedMeSuper[$candidate->id] ?? false)) {
            $score += 20;
        }

        if ($this->isBoostActive($candidate)) {
            $score += 120;
        }

        $seenMinutes = $this->seenMinutesAgo($candidate);

        if ($seenMinutes !== null && $seenMinutes <= 15) {
            $score += 25;
        } elseif ($seenMinutes !== null && $seenMinutes <= 60) {
            $score += 15;
        } elseif ($seenMinutes !== null && $seenMinutes <= 1440) {
            $score += 8;
        }

        $have = $this->normalizeInterests($candidate->dating_interests ?? []);

        $interestMatch = $this->matchInterests($this->normalizeInterests($myInterests), $have);
        $interestScore = $interestMatch['exact'] * 8 + $interestMatch['similar'] * 4;
        $score += min(24, $interestScore);

        if ($myGoal && $candidate->dating_goal && $candidate->dating_goal === $myGoal) {
            $score += 10;
        }

        $photoCount = $candidate->relationLoaded('profilePhotos')
            ? $candidate->profilePhotos->count()
            : 0;

        if ($photoCount > 0 || $candidate->avatar_url) {
            $score += 8;
        }

        if (trim((string) ($candidate->dating_about ?? '')) !== '') {
            $score += 4;
        }

        if ($candidate->isPro()) {
            $score += 4;
        }

        if ($distance !== null && $distance <= 5) {
            $score += 10;
        } elseif ($distance !== null && $distance <= 25) {
            $score += 6;
        } elseif ($distance !== null && $distance <= 100) {
            $score += 3;
        }

        if ($this->isNewcomer($candidate)) {
            $score += 12;
        }

        $score += mt_rand(0, 6);

        return $score;
    }

    /**
     * Сколько минут назад кандидат был в сети. Null — неизвестно.
     *
     * @param User $candidate
     * @return int|null
     */
    private function seenMinutesAgo(User $candidate): ?int
    {
        if (! $candidate->last_seen_at) {
            return null;
        }

        try {
            return max(0, $candidate->last_seen_at->diffInMinutes(now()));
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Новичок ли кандидат (регистрация меньше 7 дней назад).
     *
     * @param User $candidate
     * @return bool
     */
    private function isNewcomer(User $candidate): bool
    {
        if (! $candidate->created_at) {
            return false;
        }

        try {
            return $candidate->created_at->diffInDays(now()) < 7;
        } catch (\Throwable) {
            return false;
        }
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
            ->whereNotNull('birth_date')
            ->where('birth_date', '<=', $adultThreshold)
            ->when(! $me->isAdmin() && ! User::isGhostSeer($me), function ($query) {
                $query->where('is_admin', false);
            });

        $total = (int) (clone $baseQuery)->count();
        $perPage = max(1, $limit);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = max(1, min($page, $lastPage));

        $candidates = (clone $baseQuery)
            ->select([
                'id', 'name', 'profile_slug', 'gender', 'birth_date', 'bio', 'avatar_path', 'telegram_photo_url',
                'home_city', 'home_lat', 'home_lng', 'last_seen_at',
                'dating_goal', 'dating_custom_goal', 'dating_about', 'dating_interests', 'dating_hide_name', 'dating_hide_age', 'dating_hide_distance',
                'dating_match_only', 'message_privacy', 'allow_random_messages',
                'plan', 'plan_expires_at', 'is_admin', 'role', 'is_invisible',
            ])
            ->orderByDesc('last_seen_at')
            ->forPage($page, $perPage)
            ->get();

        $candidates = $this->withoutInvisible($candidates, $me);

        $this->attachPhotos($candidates);

        $likedMeIds = SwipeAction::where('liked_id', $me->id)
            ->where('action', 'like')
            ->pluck('liker_id')
            ->flip();

        $matchedIds = $this->matchedIds($me);
        $matchedFlip = array_flip($matchedIds);

        $onlineIds = $candidates->map(fn ($candidate) => (int) $candidate->id)->all();
        $ratings = app(DatingReviewService::class)->summariesFor($onlineIds, $me);

        $result = [];

        foreach ($candidates as $candidate) {
            $distance = $this->distanceKm($me, $candidate);
            $isMatch = isset($matchedFlip[$candidate->id]);
            $card = $this->cardFor($candidate, $me, $distance, $isMatch, isset($likedMeIds[$candidate->id]), $ratings[(int) $candidate->id] ?? null);

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
            ->with(['userA:id,name,avatar_path,telegram_photo_url,last_seen_at,is_invisible,plan,role,is_admin', 'userB:id,name,avatar_path,telegram_photo_url,last_seen_at,is_invisible,plan,role,is_admin'])
            ->orderByDesc('created_at')
            ->forPage($page, $perPage)
            ->get();

        $convByOther = $this->directConversationMap($me);

        $cards = [];

        foreach ($rows as $row) {
            $other = $row->otherUser($me->id);

            $hiddenOnline = $other->isInvisibleActive() && ! $me->isAdmin();

            $cards[] = [
                'match_id' => $row->id,
                'created_at' => $row->created_at,
                'conversation_id' => $convByOther[$other->id] ?? null,
                'user' => [
                    'id' => $other->id,
                    'name' => $other->name,
                    'avatar_url' => $other->avatar_url,
                    'last_seen_at' => $hiddenOnline ? null : $other->last_seen_at?->toISOString(),
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
     * Убрать из выборки пользователей с активной невидимкой.
     *
     * Невидимка (Pro и выше) полностью скрывает онлайн: таких людей
     * не показываем ни в ленте, ни в «кто онлайн» — кроме просмотра
     * админом. Спящий флаг у Free-тарифа (без права на невидимку)
     * игнорируем через isInvisibleActive.
     *
     * @param \Illuminate\Support\Collection<int, User> $candidates кандидаты из БД
     * @param User $viewer кто смотрит
     * @return \Illuminate\Support\Collection<int, User> кандидаты без невидимок
     */
    private function withoutInvisible($candidates, User $viewer)
    {
        if ($viewer->isAdmin()) {
            return $candidates->values();
        }

        return $candidates
            ->reject(fn (User $candidate) => $candidate->isInvisibleActive())
            ->values();
    }

    /**
     * Прицепить фото кандидатов пачкой: до лимита на человека.
     *
     * Eager-load вида with([relation => limit(N)]) режет лимит глобально
     * по всему запросу, а не на каждого родителя: первые кандидаты
     * забирали бы все фото, остальные оставались бы с пустыми галереями
     * (и уходили в fallback на аватар). Поэтому грузим одним запросом
     * все фото выборки и раскладываем по людям в PHP.
     *
     * @param iterable<int, User> $candidates кандидаты без фото
     * @return void
     */
    private function attachPhotos(iterable $candidates): void
    {
        $ids = collect($candidates)
            ->map(fn (User $candidate) => (int) $candidate->id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return;
        }

        $rows = ProfilePhoto::whereIn('user_id', $ids)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $grouped = [];

        foreach ($rows as $photo) {
            $uid = (int) $photo->user_id;

            if (count($grouped[$uid] ?? []) >= self::SWIPE_PHOTOS_LIMIT_PRO) {
                continue;
            }

            $grouped[$uid][] = $photo;
        }

        foreach ($candidates as $candidate) {
            $candidate->setRelation('profilePhotos', collect($grouped[(int) $candidate->id] ?? []));
        }
    }

    /**
     * Публичная карточка кандидата с учётом приватности.
     *
     * @param User $candidate
     * @param User $viewer
     * @param float|null $distanceKm
     * @param bool $isMatch
     * @param bool $likedMe
     * @param array{avg:float|null,count:int,hidden:bool}|null $rating готовая сводка (null — посчитать тут)
     * @return array<string,mixed>
     */
    public function cardFor(User $candidate, User $viewer, ?float $distanceKm, bool $isMatch, bool $likedMe, ?array $rating = null): array
    {
        $canSeeReal = $viewer->id === $candidate->id || $viewer->isAdmin() || $isMatch;

        $hideName = (bool) $candidate->dating_hide_name && ! $canSeeReal;
        $hideAge = (bool) $candidate->dating_hide_age && ! $canSeeReal;
        $hideDistance = (bool) ($candidate->dating_hide_distance ?? false) && ! $canSeeReal;

        $hiddenOnline = $candidate->isInvisibleActive() && ! $viewer->isAdmin();

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

        $rating ??= app(DatingReviewService::class)->summary($candidate, $viewer);

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
            'last_seen_at' => $hiddenOnline ? null : $candidate->last_seen_at?->toISOString(),
            'is_match' => $isMatch,
            'liked_me' => $likedMe,
            'is_superlike' => false,
            'is_boosted' => false,
            'rating_avg' => $rating['avg'] ?? null,
            'rating_count' => (int) ($rating['count'] ?? 0),
            'rating_hidden' => (bool) ($rating['hidden'] ?? false),
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
