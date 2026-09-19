<?php

namespace App\Services;

use App\Models\ActivityRewardClaim;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Награды за активность: очки репутации за действия пользователя.
 *
 * Лимиты — недельные (ISO-неделя, понедельник — воскресенье):
 * счётчик обнуляется каждый понедельник, накопить за неделю больше
 * капа нельзя.
 *
 * Антишулерство: награда привязывается к объекту (пост, пин, человек).
 * Повтор того же действия над тем же объектом в ту же неделю упирается
 * в уникальный ключ таблицы activity_reward_claims и очков не даёт:
 * снял лайк → поставил заново = 0, удалил коммент → написал новый = 0.
 * Награждение никогда не ломает основное действие: все ошибки
 * гасятся внутри award(), контроллер просто не кладёт reward в ответ.
 */
class ActivityRewards
{
    /**
     * Таблица наград: код действия => [очки, недельный кап, подпись для логов].
     *
     * @var array<string, array{points:int, weekly_cap:int, label:string}>
     */
    public const REWARDS = [
        'pin_create' => ['points' => 15, 'weekly_cap' => 5, 'label' => 'Создание пина'],
        'pin_reaction' => ['points' => 1, 'weekly_cap' => 50, 'label' => 'Реакция на пин'],
        'pin_comment' => ['points' => 3, 'weekly_cap' => 30, 'label' => 'Комментарий под пином'],
        'flow_post' => ['points' => 10, 'weekly_cap' => 5, 'label' => 'Пост в UFlow'],
        'flow_like' => ['points' => 1, 'weekly_cap' => 50, 'label' => 'Лайк поста UFlow'],
        'flow_liked' => ['points' => 2, 'weekly_cap' => 200, 'label' => 'Лайк моего поста UFlow'],
        'flow_comment' => ['points' => 3, 'weekly_cap' => 30, 'label' => 'Комментарий в UFlow'],
        'flow_repost' => ['points' => 5, 'weekly_cap' => 5, 'label' => 'Репост в UFlow'],
        'poll_vote' => ['points' => 1, 'weekly_cap' => 10, 'label' => 'Голос в опросе'],
        'swipe_like' => ['points' => 1, 'weekly_cap' => 100, 'label' => 'Лайк в свайпах'],
        'swipe_pass' => ['points' => 1, 'weekly_cap' => 100, 'label' => 'Пас в свайпах'],
        'swipe_match' => ['points' => 10, 'weekly_cap' => 10, 'label' => 'Мэтч в свайпах'],
        'photo_upload' => ['points' => 5, 'weekly_cap' => 3, 'label' => 'Фото в профиль'],
        'photo_like' => ['points' => 1, 'weekly_cap' => 50, 'label' => 'Лайк фото'],
        'photo_liked' => ['points' => 2, 'weekly_cap' => 200, 'label' => 'Лайк моего фото'],
        'district_post' => ['points' => 10, 'weekly_cap' => 5, 'label' => 'Новость района'],
        'district_like' => ['points' => 1, 'weekly_cap' => 50, 'label' => 'Лайк новости района'],
        'district_liked' => ['points' => 2, 'weekly_cap' => 200, 'label' => 'Лайк моей новости'],
        'district_comment' => ['points' => 3, 'weekly_cap' => 30, 'label' => 'Комментарий в районе'],
        'chat_message' => ['points' => 1, 'weekly_cap' => 50, 'label' => 'Сообщение в чате'],
    ];

    /**
     * Ключ текущей недели (ISO: год-неделя, сброс по понедельникам).
     *
     * @return string вида 2026-W38
     */
    public static function weekKey(): string
    {
        return now()->format('o-\\WW');
    }

    /**
     * Ключ прошлой недели (для понедельничного итога).
     *
     * @return string вида 2026-W37
     */
    public static function lastWeekKey(): string
    {
        return now()->subWeek()->format('o-\\WW');
    }

    /**
     * Каталог наград для API: фронт рисует таб «Система рейтинга» из него,
     * поэтому таблица в интерфейсе всегда синхронна с бэком.
     *
     * @return array<int, array{code:string, points:int, weekly_cap:int, label:string}>
     */
    public static function catalog(): array
    {
        $rows = [];

        foreach (self::REWARDS as $code => $def) {
            $rows[] = [
                'code' => $code,
                'points' => $def['points'],
                'weekly_cap' => $def['weekly_cap'],
                'label' => $def['label'],
            ];
        }

        return $rows;
    }

    /**
     * Прогресс недели: сколько заработано и сколько капа использовано
     * по каждому действию. Лежит в /api/quests как weekly.
     *
     * @param User $user пользователь
     * @param string|null $weekKey неделя (по умолчанию текущая)
     * @return array{week_key:string, total_earned:int, actions:array<int, array{code:string, label:string, points:int, weekly_cap:int, used:int, earned:int}>}
     */
    public static function weeklyStats(User $user, ?string $weekKey = null): array
    {
        $week = $weekKey ?? self::weekKey();

        $rows = ActivityRewardClaim::where('user_id', $user->id)
            ->where('week_key', $week)
            ->selectRaw('action, COUNT(*) as used, COALESCE(SUM(points), 0) as earned')
            ->groupBy('action')
            ->get()
            ->keyBy('action');

        $actions = [];
        $total = 0;

        foreach (self::REWARDS as $code => $def) {
            $row = $rows->get($code);
            $used = (int) ($row->used ?? 0);
            $earned = (int) ($row->earned ?? 0);
            $total += $earned;

            $actions[] = [
                'code' => $code,
                'label' => $def['label'],
                'points' => $def['points'],
                'weekly_cap' => $def['weekly_cap'],
                'used' => $used,
                'earned' => $earned,
            ];
        }

        return [
            'week_key' => $week,
            'total_earned' => $total,
            'actions' => $actions,
        ];
    }

    /**
     * Начислить очки за действие с учётом недельного капа и повторов.
     *
     * Возвращает null, когда начислять нечего: неизвестный код, кап
     * исчерпан или это действие над этим объектом уже оплачено
     * на текущей неделе. Никогда не бросает исключений.
     *
     * @param User $user кого наградить
     * @param string $action код из REWARDS
     * @param string|null $targetType тип объекта (flow_post, pin, user…) или null без привязки
     * @param int|null $targetId id объекта
     * @param string|null $meta доп. измерение (например id лайкнувшего для бонуса автору)
     * @return array{awarded:int, action:string, score:int, level:string, level_name:string, leveled_up:bool, rating:array}|null
     */
    public static function award(User $user, string $action, ?string $targetType = null, ?int $targetId = null, ?string $meta = null): ?array
    {
        try {
            $def = self::REWARDS[$action] ?? null;

            if ($def === null || $def['points'] <= 0) {
                return null;
            }

            $week = self::weekKey();
            $type = $targetType ?? '';
            $target = $targetId ?? 0;

            if ($type !== '' && $target > 0) {
                $already = ActivityRewardClaim::where('user_id', $user->id)
                    ->where('action', $action)
                    ->where('target_type', $type)
                    ->where('target_id', $target)
                    ->where('meta', $meta ?? '')
                    ->where('week_key', $week)
                    ->exists();

                if ($already) {
                    return null;
                }
            }

            $used = ActivityRewardClaim::where('user_id', $user->id)
                ->where('action', $action)
                ->where('week_key', $week)
                ->count();

            if ($used >= $def['weekly_cap']) {
                return null;
            }

            $scored = DB::transaction(function () use ($user, $action, $type, $target, $meta, $week, $def) {
                ActivityRewardClaim::create([
                    'user_id' => $user->id,
                    'action' => $action,
                    'target_type' => $type,
                    'target_id' => $target,
                    'meta' => $meta ?? ($type === '' ? Str::uuid()->toString() : ''),
                    'week_key' => $week,
                    'points' => $def['points'],
                ]);

                return ReputationService::addScore($user->fresh(), $def['points'], 'activity:'.$action);
            });

            $fresh = $user->fresh();
            $state = ReputationService::state($fresh);

            return [
                'awarded' => $def['points'],
                'action' => $action,
                'score' => $scored['score'],
                'level' => $scored['level'],
                'level_name' => (string) ($state['level_name'] ?? $scored['level']),
                'leveled_up' => $scored['leveled_up'],
                'rating' => $state,
            ];
        } catch (QueryException $e) {
            return null;
        } catch (\Throwable $e) {
            Log::warning('activity reward failed', ['action' => $action, 'user_id' => $user->id ?? null, 'error' => $e->getMessage()]);

            return null;
        }
    }
}
