<?php

namespace App\Services;

use App\Models\User;

/**
 * Рейтинг и ранги пользователя.
 *
 * Очки (reputation_score) копятся за задания и активность.
 * Ранг (level) вычисляется по порогам и только растёт внутри цикла,
 * при падении очков ранг не понижается без явного пересчёта.
 */
class ReputationService
{
    /**
     * Шкала рангов: код => [порог очков, русское название, иконка primeicons].
     *
     * @var array<string, array{points:int, name:string, icon:string}>
     */
    public const RANKS = [
        'novice' => ['points' => 0, 'name' => 'Новичок', 'icon' => 'pi pi-sparkles'],
        'explorer' => ['points' => 150, 'name' => 'Исследователь', 'icon' => 'pi pi-compass'],
        'active' => ['points' => 350, 'name' => 'Активист', 'icon' => 'pi pi-bolt'],
        'local' => ['points' => 700, 'name' => 'Свой в городе', 'icon' => 'pi pi-map-marker'],
        'veteran' => ['points' => 1200, 'name' => 'Ветеран', 'icon' => 'pi pi-shield'],
        'legend' => ['points' => 2000, 'name' => 'Легенда', 'icon' => 'pi pi-star'],
        'guide' => ['points' => 3500, 'name' => 'Гид', 'icon' => 'pi pi-crown'],
    ];

    /**
     * Упорядоченные коды рангов от младшего к старшему.
     *
     * @return string[]
     */
    public static function orderedCodes(): array
    {
        $codes = array_keys(self::RANKS);
        usort($codes, fn ($a, $b) => self::RANKS[$a]['points'] <=> self::RANKS[$b]['points']);

        return $codes;
    }

    /**
     * Ранг по количеству очков.
     *
     * @param int $score
     * @return string
     */
    public static function rankFor(int $score): string
    {
        $current = 'novice';
        foreach (self::orderedCodes() as $code) {
            if ($score >= self::RANKS[$code]['points']) {
                $current = $code;
            }
        }

        return $current;
    }

    /**
     * Следующий ранг и прогресс до него.
     *
     * @param int $score
     * @return array{code:string|null, name:string|null, points:int, current:int, needed:int, percent:int}
     */
    public static function nextRank(int $score): array
    {
        $ordered = self::orderedCodes();
        $current = self::rankFor($score);
        $idx = array_search($current, $ordered, true);
        $next = $ordered[$idx + 1] ?? null;

        if ($next === null) {
            return [
                'code' => null,
                'name' => null,
                'points' => $score,
                'current' => $score,
                'needed' => 0,
                'percent' => 100,
            ];
        }

        $curPoints = self::RANKS[$current]['points'];
        $nextPoints = self::RANKS[$next]['points'];
        $span = max(1, $nextPoints - $curPoints);
        $done = max(0, min($span, $score - $curPoints));

        return [
            'code' => $next,
            'name' => self::RANKS[$next]['name'],
            'points' => $nextPoints,
            'current' => $score,
            'needed' => max(0, $nextPoints - $score),
            'percent' => (int) round($done / $span * 100),
        ];
    }

    /**
     * Начислить очки и при необходимости повысить ранг.
     *
     * @param User $user
     * @param int $points положительные очки
     * @param string $reason причина для логов
     * @return array{score:int, level:string, leveled_up:bool, old_level:string}
     */
    public static function addScore(User $user, int $points, string $reason = ''): array
    {
        $points = max(0, $points);
        if ($points === 0) {
            return [
                'score' => (int) $user->reputation_score,
                'level' => (string) $user->level,
                'leveled_up' => false,
                'old_level' => (string) $user->level,
            ];
        }

        $oldLevel = (string) ($user->level ?? 'novice');
        $score = (int) ($user->reputation_score ?? 0) + $points;
        $level = self::rankFor($score);

        $user->forceFill([
            'reputation_score' => $score,
            'level' => $level,
        ])->save();

        return [
            'score' => $score,
            'level' => $level,
            'leveled_up' => $level !== $oldLevel,
            'old_level' => $oldLevel,
        ];
    }

    /**
     * Полное состояние рейтинга для API.
     *
     * @param User $user
     * @return array
     */
    public static function state(User $user): array
    {
        $score = (int) ($user->reputation_score ?? 0);
        $level = (string) ($user->level ?? self::rankFor($score));
        $meta = self::RANKS[$level] ?? self::RANKS['novice'];
        $next = self::nextRank($score);

        return [
            'score' => $score,
            'level' => $level,
            'level_name' => $meta['name'],
            'level_icon' => $meta['icon'],
            'next' => $next,
            'ranks' => collect(self::RANKS)->map(fn ($r, $code) => [
                'code' => $code,
                'name' => $r['name'],
                'icon' => $r['icon'],
                'points' => $r['points'],
                'reached' => $score >= $r['points'],
            ])->values()->all(),
        ];
    }
}
