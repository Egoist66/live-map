<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Быстрые инсайты для Telegram-бота: лайки, мэтчи, сообщения, статистика.
 *
 * Лёгкие запросы без тяжёлого DatingService — боту нужны только
 * счётчики и топ-3 имени для вау-эффекта, а не полные карточки.
 */
class TelegramInsights
{
    /**
     * Сколько непрочитанных сообщений ждёт пользователя.
     *
     * @param User $user получатель
     * @return int
     */
    public static function unreadCount(User $user): int
    {
        try {
            return $user->unreadMessagesCount();
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * Сколько лайков получила анкета + свежие имена.
     *
     * @param User $user владелец анкеты
     * @return array{total:int, names:array<int, string>}
     */
    public static function admirers(User $user): array
    {
        try {
            $total = (int) DB::table('swipe_actions')
                ->where('liked_id', (int) $user->id)
                ->where('action', 'like')
                ->count();
        } catch (\Throwable) {
            return ['total' => 0, 'names' => []];
        }

        $names = [];

        try {
            $likerIds = DB::table('swipe_actions')
                ->where('liked_id', (int) $user->id)
                ->where('action', 'like')
                ->orderByDesc('id')
                ->limit(3)
                ->pluck('liker_id')
                ->map(fn ($id): int => (int) $id)
                ->all();

            if ($likerIds !== []) {
                $names = User::whereIn('id', $likerIds)
                    ->pluck('name')
                    ->map(fn ($name): string => trim((string) $name))
                    ->filter(fn (string $name): bool => $name !== '')
                    ->values()
                    ->all();
            }
        } catch (\Throwable) {
            $names = [];
        }

        return ['total' => $total, 'names' => $names];
    }

    /**
     * Сколько мэтчей + свежие имена.
     *
     * @param User $user участник
     * @return array{total:int, names:array<int, string>}
     */
    public static function matches(User $user): array
    {
        $userId = (int) $user->id;

        try {
            $rows = DB::table('dating_matches')
                ->where('user_a', $userId)
                ->orWhere('user_b', $userId)
                ->orderByDesc('id')
                ->limit(3)
                ->get(['user_a', 'user_b']);
        } catch (\Throwable) {
            return ['total' => 0, 'names' => []];
        }

        $total = 0;

        try {
            $total = (int) DB::table('dating_matches')
                ->where('user_a', $userId)
                ->orWhere('user_b', $userId)
                ->count();
        } catch (\Throwable) {
            $total = count($rows);
        }

        $peerIds = [];

        foreach ($rows as $row) {
            $a = (int) ($row->user_a ?? 0);
            $b = (int) ($row->user_b ?? 0);
            $peer = $a === $userId ? $b : $a;

            if ($peer > 0) {
                $peerIds[] = $peer;
            }
        }

        $names = [];

        if ($peerIds !== []) {
            try {
                $names = User::whereIn('id', $peerIds)
                    ->pluck('name')
                    ->map(fn ($name): string => trim((string) $name))
                    ->filter(fn (string $name): bool => $name !== '')
                    ->values()
                    ->all();
            } catch (\Throwable) {
                $names = [];
            }
        }

        return ['total' => $total, 'names' => $names];
    }

    /**
     * Короткая строка статистики для /stats.
     *
     * @param User $user владелец
     * @return string HTML-текст
     */
    public static function statsText(User $user): string
    {
        $fresh = $user->fresh() ?? $user;

        $plan = (string) ($fresh->effectivePlan() ?? 'free');
        $planLabel = self::planLabel($plan);

        $level = (int) ($fresh->level ?? 1);
        $reputation = (int) ($fresh->reputation_score ?? 0);

        $admirers = self::admirers($fresh);
        $matches = self::matches($fresh);
        $unread = self::unreadCount($fresh);

        $lines = [];
        $lines[] = '📊 <b>Ваша статистика</b>';
        $lines[] = '';
        $lines[] = '💎 Тариф: <b>'.$planLabel.'</b>';
        $lines[] = '⭐ Уровень: <b>'.$level.'</b> · Репутация: <b>'.$reputation.'</b>';
        $lines[] = '💞 Лайков анкеты: <b>'.$admirers['total'].'</b>';
        $lines[] = '🎉 Мэтчей: <b>'.$matches['total'].'</b>';
        $lines[] = '💬 Непрочитанных: <b>'.$unread.'</b>';

        if ($fresh->isProfileHidden()) {
            $lines[] = '';
            $lines[] = '🙈 Анкета сейчас <b>скрыта</b> — вас никто не видит. /show чтобы вернуться.';
        }

        if ($fresh->isPendingDeletion()) {
            $days = $fresh->deletionDaysLeft() ?? 0;
            $lines[] = '';
            $lines[] = '⏳ Удаление через <b>'.$days.' дн.</b> — /restore чтобы остаться.';
        }

        return implode("\n", $lines);
    }

    /**
     * Человеческое имя тарифа.
     *
     * @param string $plan free|pro|premium|business
     * @return string
     */
    public static function planLabel(string $plan): string
    {
        return match ($plan) {
            'pro' => 'PRO',
            'premium' => 'Premium',
            'business' => 'Business',
            default => 'Free',
        };
    }
}
