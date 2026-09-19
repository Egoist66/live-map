<?php

namespace App\Services;

use App\Models\DatingMatch;
use App\Models\Message;
use App\Models\Pin;
use App\Models\PinComment;
use App\Models\PinInvite;
use App\Models\QuestReward;
use App\Models\Reaction;
use App\Models\SwipeAction;
use App\Models\User;
use App\Models\UserQuestProgress;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Прогресс заданий и выдача PRO-недели.
 *
 * Цикл = календарный месяц (cycle_key Y-m).
 * Прогресс считается по действиям с начала цикла,
 * XP начисляется один раз за задание, PRO — за полный трек.
 */
class QuestService
{
    public const PREMIUM_DAYS = 7;

    public const COOLDOWN_DAYS = 30;

    /**
     * Ключ текущего цикла.
     *
     * @return string Y-m
     */
    public static function cycleKey(): string
    {
        return Carbon::now()->format('Y-m');
    }

    /**
     * Начало текущего цикла.
     *
     * @return \Carbon\Carbon
     */
    public static function cycleStart(): Carbon
    {
        return Carbon::now()->startOfMonth();
    }

    /**
     * Полное состояние заданий пользователя для API.
     *
     * @param User $user
     * @return array
     */
    public static function state(User $user): array
    {
        $user->refresh();
        $cycle = self::cycleKey();
        $start = self::cycleStart();

        $tracks = [];
        foreach (['pins', 'swipes'] as $track) {
            $quests = [];
            $done = 0;

            foreach (QuestCatalog::all()[$track] as $def) {
                $progress = self::measure($user, $def['code'], $start);
                $row = self::persistProgress($user, $track, $def, $progress, $cycle);
                $isDone = $progress >= $def['target'];
                if ($isDone) {
                    $done++;
                }

                $quests[] = [
                    'code' => $def['code'],
                    'title' => $def['title'],
                    'desc' => $def['desc'],
                    'hint' => $def['hint'],
                    'xp' => $def['xp'],
                    'target' => $def['target'],
                    'icon' => $def['icon'],
                    'progress' => $progress,
                    'completed' => $isDone,
                    'completed_at' => $row?->completed_at?->toISOString(),
                    'percent' => (int) round(min(1, $progress / max(1, $def['target'])) * 100),
                ];
            }

            $tracks[$track] = [
                'code' => $track,
                'completed_count' => $done,
                'total' => count($quests),
                'is_complete' => $done === count($quests),
                'total_xp' => array_sum(array_column($quests, 'xp')),
                'earned_xp' => array_sum(array_map(
                    fn ($q) => $q['completed'] ? $q['xp'] : 0,
                    $quests
                )),
                'quests' => $quests,
            ];
        }

        $cooldownUntil = $user->quest_cooldown_until ? Carbon::parse($user->quest_cooldown_until) : null;
        $onCooldown = $cooldownUntil && $cooldownUntil->isFuture();
        $lastReward = QuestReward::where('user_id', $user->id)->latest('granted_at')->first();
        $isPremium = $user->isPro();
        $premiumFromQuest = $user->quest_granted_at
            && $user->plan_expires_at
            && Carbon::parse($user->plan_expires_at)->isFuture()
            && $user->effectivePlan() === 'pro';

        return [
            'cycle_key' => $cycle,
            'rating' => ReputationService::state($user),
            'rating_catalog' => ActivityRewards::catalog(),
            'weekly' => ActivityRewards::weeklyStats($user),
            'tracks' => $tracks,
            'can_claim' => [
                'pins' => self::canClaim($user, 'pins', $tracks['pins']['is_complete'], $onCooldown, $isPremium),
                'swipes' => self::canClaim($user, 'swipes', $tracks['swipes']['is_complete'], $onCooldown, $isPremium),
            ],
            'cooldown_until' => $cooldownUntil?->toISOString(),
            'on_cooldown' => $onCooldown,
            'cooldown_days_left' => $onCooldown ? $cooldownUntil->diffInDays(Carbon::now()) + 1 : 0,
            'is_premium' => $isPremium,
            'premium_from_quest' => (bool) $premiumFromQuest,
            'premium_expires_at' => $user->plan_expires_at?->toISOString(),
            'last_reward' => $lastReward ? [
                'track' => $lastReward->track,
                'granted_at' => $lastReward->granted_at?->toISOString(),
                'expires_at' => $lastReward->expires_at?->toISOString(),
            ] : null,
            'premium_days' => self::PREMIUM_DAYS,
            'cooldown_days' => self::COOLDOWN_DAYS,
        ];
    }

    /**
     * Можно ли забрать PRO за трек.
     *
     * @param User $user
     * @param string $track
     * @param bool $trackComplete
     * @param bool $onCooldown
     * @param bool $isPremium
     * @return array{allowed:bool, reason:string|null}
     */
    public static function canClaim(User $user, string $track, bool $trackComplete, bool $onCooldown, bool $isPremium): array
    {
        if (! $trackComplete) {
            return ['allowed' => false, 'reason' => 'Закрой все 5 заданий трека'];
        }

        if ($onCooldown) {
            return ['allowed' => false, 'reason' => 'Следующие задания через месяц'];
        }

        if ($user->effectivePlan() === 'business') {
            return ['allowed' => false, 'reason' => 'У тебя уже Business — выше некуда'];
        }

        if ($isPremium && $user->quest_granted_at === null) {
            $expires = $user->plan_expires_at ? Carbon::parse($user->plan_expires_at) : null;
            $longPaid = $expires && $expires->diffInDays(Carbon::now()) > self::PREMIUM_DAYS + 1;
            if ($longPaid) {
                return ['allowed' => false, 'reason' => 'PRO уже активен — задания откроются позже'];
            }
        }

        return ['allowed' => true, 'reason' => null];
    }

    /**
     * Забрать PRO-неделю за полностью закрытый трек.
     *
     * @param User $user
     * @param string $track pins|swipes
     * @return array
     *
     * @throws \RuntimeException
     */
    public static function claim(User $user, string $track): array
    {
        abort_unless(in_array($track, ['pins', 'swipes'], true), 422, 'Неизвестный трек');

        $state = self::state($user->fresh());
        $check = $track === 'pins' ? $state['can_claim']['pins'] : $state['can_claim']['swipes'];
        abort_if(! $check['allowed'], 422, $check['reason'] ?? 'Забрать PRO пока нельзя');

        $now = Carbon::now();
        $expires = $now->copy()->addDays(self::PREMIUM_DAYS);
        $cooldown = $now->copy()->addDays(self::COOLDOWN_DAYS);

        $currentExpiry = $user->plan_expires_at ? Carbon::parse($user->plan_expires_at) : null;
        $base = ($currentExpiry && $currentExpiry->isFuture() && $user->effectivePlan() === 'pro')
            ? $currentExpiry->copy()->addDays(self::PREMIUM_DAYS)
            : $expires;

        DB::transaction(function () use ($user, $track, $now, $base, $cooldown) {
            $user->forceFill([
                'plan' => 'pro',
                'plan_expires_at' => $base,
                'quest_cooldown_until' => $cooldown,
                'quest_last_track' => $track,
                'quest_granted_at' => $now,
            ])->save();

            QuestReward::create([
                'user_id' => $user->id,
                'track' => $track,
                'cycle_key' => self::cycleKey(),
                'granted_at' => $now,
                'expires_at' => $base,
                'cooldown_until' => $cooldown,
            ]);
        });

        $fresh = $user->fresh();

        return [
            'ok' => true,
            'track' => $track,
            'premium_until' => $base->toISOString(),
            'cooldown_until' => $cooldown->toISOString(),
            'rating' => ReputationService::state($fresh),
        ];
    }

    /**
     * Сохранить прогресс и начислить XP за впервые закрытое задание.
     *
     * @param User $user
     * @param string $track
     * @param array $def
     * @param int $progress
     * @param string $cycle
     * @return \App\Models\UserQuestProgress|null
     */
    protected static function persistProgress(User $user, string $track, array $def, int $progress, string $cycle): ?UserQuestProgress
    {
        $progress = max(0, min($progress, $def['target'] * 4));
        $isDone = $progress >= $def['target'];

        $row = UserQuestProgress::firstOrNew([
            'user_id' => $user->id,
            'track' => $track,
            'code' => $def['code'],
            'cycle_key' => $cycle,
        ]);

        $row->fill([
            'progress' => $progress,
            'target' => $def['target'],
            'is_completed' => $isDone,
            'completed_at' => $isDone ? ($row->completed_at ?? Carbon::now()) : null,
        ]);
        $row->save();

        if ($isDone && ! $row->xp_awarded) {
            ReputationService::addScore($user->fresh(), $def['xp'], 'quest:'.$def['code']);
            $row->forceFill(['xp_awarded' => true])->saveQuietly();
            $user->refresh();
        }

        return $row;
    }

    /**
     * Замер прогресса по коду задания с начала цикла.
     *
     * @param User $user
     * @param string $code
     * @param \Carbon\Carbon $start
     * @return int
     */
    protected static function measure(User $user, string $code, Carbon $start): int
    {
        try {
            return match ($code) {
                'pins_first' => self::countPins($user, $start, 1),
                'pins_series' => self::countPins($user, $start, 5),
                'pins_reactions' => self::countPinReactions($user, $start),
                'pins_comments' => self::countPinComments($user, $start),
                'pins_invites' => self::countPinInvites($user, $start),
                'swipes_profile' => self::profileScore($user) >= 3 ? 1 : 0,
                'swipes_swipes30' => self::countSwipes($user, $start),
                'swipes_admirers5' => self::countAdmirers($user, $start),
                'swipes_matches3' => self::countMatches($user, $start),
                'swipes_chats3' => self::countMatchDialogs($user, $start),
                default => 0,
            };
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * Пинов создано с начала цикла.
     */
    protected static function countPins(User $user, Carbon $start, int $cap): int
    {
        $total = Pin::where('user_id', $user->id)
            ->where('created_at', '>=', $start)
            ->count();

        return min($total, $cap);
    }

    /**
     * Реакций других людей на пины пользователя.
     */
    protected static function countPinReactions(User $user, Carbon $start): int
    {
        $pinIds = Pin::where('user_id', $user->id)->pluck('id');
        if ($pinIds->isEmpty()) {
            return 0;
        }

        $count = Reaction::whereIn('reactable_id', $pinIds)
            ->where('reactable_type', 'like', '%Pin%')
            ->where('user_id', '!=', $user->id)
            ->where('created_at', '>=', $start)
            ->count();

        return min($count, 40);
    }

    /**
     * Комментариев других людей под пинами пользователя.
     */
    protected static function countPinComments(User $user, Carbon $start): int
    {
        $pinIds = Pin::where('user_id', $user->id)->pluck('id');
        if ($pinIds->isEmpty()) {
            return 0;
        }

        $count = PinComment::whereIn('pin_id', $pinIds)
            ->where('user_id', '!=', $user->id)
            ->where('created_at', '>=', $start)
            ->count();

        return min($count, 20);
    }

    /**
     * Инвайтов в пины отправлено.
     */
    protected static function countPinInvites(User $user, Carbon $start): int
    {
        try {
            $count = PinInvite::where('inviter_id', $user->id)
                ->where('created_at', '>=', $start)
                ->count();
        } catch (\Throwable) {
            try {
                $count = PinInvite::where('user_id', $user->id)
                    ->where('created_at', '>=', $start)
                    ->count();
            } catch (\Throwable) {
                $count = 0;
            }
        }

        return min($count, 12);
    }

    /**
     * Заполненность анкеты: 0-3 (о себе, интересы, фото).
     */
    protected static function profileScore(User $user): int
    {
        $fresh = $user->fresh() ?? $user;
        $score = 0;

        $about = trim((string) ($fresh->dating_about ?? ''));
        if (mb_strlen($about) >= 20) {
            $score++;
        }

        $interests = $fresh->dating_interests ?? [];
        if (is_string($interests)) {
            $interests = json_decode($interests, true) ?: [];
        }
        if (is_array($interests) && count($interests) >= 3) {
            $score++;
        }

        try {
            $photos = $fresh->profilePhotos()->count();
        } catch (\Throwable) {
            $photos = $fresh->avatar_path ? 1 : 0;
        }
        if ($photos >= 1) {
            $score++;
        }

        return $score;
    }

    /**
     * Свайпов сделано.
     */
    protected static function countSwipes(User $user, Carbon $start): int
    {
        $count = SwipeAction::where('liker_id', $user->id)
            ->where('created_at', '>=', $start)
            ->count();

        return min($count, 120);
    }

    /**
     * Входящих лайков получено.
     */
    protected static function countAdmirers(User $user, Carbon $start): int
    {
        $count = SwipeAction::where('liked_id', $user->id)
            ->where('action', 'like')
            ->where('created_at', '>=', $start)
            ->count();

        return min($count, 20);
    }

    /**
     * Мэтчей с начала цикла.
     */
    protected static function countMatches(User $user, Carbon $start): int
    {
        $count = DatingMatch::where(fn ($q) => $q
            ->where('user_a_id', $user->id)
            ->orWhere('user_b_id', $user->id))
            ->where('created_at', '>=', $start)
            ->count();

        return min($count, 12);
    }

    /**
     * Диалогов после мэтча, где пользователь написал первым (3 разных собеседника).
     */
    protected static function countMatchDialogs(User $user, Carbon $start): int
    {
        $matches = DatingMatch::where(fn ($q) => $q
            ->where('user_a_id', $user->id)
            ->orWhere('user_b_id', $user->id))
            ->get();

        if ($matches->isEmpty()) {
            return 0;
        }

        $otherIds = $matches->map(fn ($m) => $m->user_a_id === $user->id ? $m->user_b_id : $m->user_a_id)
            ->unique()
            ->values()
            ->all();

        $dialogs = Message::where('sender_id', $user->id)
            ->where('created_at', '>=', $start)
            ->whereIn('conversation_id', function ($q) use ($user, $otherIds) {
                $q->select('conversation_id')
                    ->from('conversation_participants')
                    ->whereIn('user_id', $otherIds);
            })
            ->distinct('conversation_id')
            ->count('conversation_id');

        return min((int) $dialogs, 12);
    }
}
