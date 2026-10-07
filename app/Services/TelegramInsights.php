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
     * Строка статистики для /stats — состав зависит от тарифа.
     *
     * Free: время в приложении, лайки неделя/месяц, просмотры,
     * мэтчи, непрочитанные. Pro: плюс топ интересов лайкнувших
     * и возраст/пол. Premium: плюс конкретные гости страницы.
     *
     * @param User $user владелец
     * @return string HTML-текст
     */
    public static function statsText(User $user): string
    {
        $fresh = $user->fresh() ?? $user;

        try {
            $stats = ProfileStatsService::summary($fresh);
        } catch (\Throwable) {
            return self::fallbackStatsText($fresh);
        }

        $plan = (string) ($stats['plan'] ?? 'free');
        $tier = (string) ($stats['tier'] ?? 'free');
        $planLabel = self::planLabel($plan);

        $likes = $stats['likes'];
        $views = $stats['views'];
        $time = $stats['time'];

        $level = (int) ($fresh->level ?? 1);
        $reputation = (int) ($fresh->reputation_score ?? 0);
        $totalUsers = self::totalUsers();

        $timeLabel = self::minutesLabel((int) $time['week_min']);

        $lines = [];
        $lines[] = '📊 <b>Ваша статистика</b>';

        if ($totalUsers > 0) {
            $lines[] = '👥 Нас в приложении уже: <b>'.$totalUsers.'</b>';
        }

        $lines[] = '';
        $lines[] = '💎 Тариф: <b>'.$planLabel.'</b>';
        $lines[] = '⭐ Уровень: <b>'.$level.'</b> · Репутация: <b>'.$reputation.'</b>';
        $lines[] = '';
        $lines[] = '⏱ В приложении: сегодня <b>'.self::minutesLabel((int) $time['today_min']).'</b>, неделя <b>'.$timeLabel.'</b>, месяц <b>'.self::minutesLabel((int) $time['month_min']).'</b>';
        $lines[] = '💞 Лайков: неделя <b>'.$likes['week'].'</b> · месяц <b>'.$likes['month'].'</b> · всего <b>'.$likes['total'].'</b>';
        $lines[] = '👀 Просмотров профиля: неделя <b>'.$views['week'].'</b> · месяц <b>'.$views['month'].'</b> · всего <b>'.$views['total'].'</b>';
        $lines[] = '🎉 Мэтчей: <b>'.(int) $stats['matches_total'].'</b>';
        $lines[] = '💬 Непрочитанных: <b>'.(int) $stats['unread'].'</b>';

        $audience = $stats['audience'];

        if (is_array($audience)) {
            $lines[] = '';
            $lines[] = '🔥 <b>Кто вас лайкает (PRO)</b>';

            $interests = array_slice($audience['interests'] ?? [], 0, 5);

            if ($interests !== []) {
                $tags = [];

                foreach ($interests as $item) {
                    $tags[] = self::esc((string) $item['tag']).' ×'.$item['count'];
                }

                $lines[] = '🏷 Топ интересов: '.implode(', ', $tags);
            } else {
                $lines[] = '🏷 Пока мало данных — лайков за месяц не было.';
            }

            $buckets = $audience['age_buckets'] ?? [];
            $parts = [];

            foreach (['18-24' => '18–24', '25-34' => '25–34', '35-44' => '35–44', '45+' => '45+'] as $key => $label) {
                $count = (int) ($buckets[$key] ?? 0);

                if ($count > 0) {
                    $parts[] = $label.': '.$count;
                }
            }

            if ($parts !== []) {
                $lines[] = '🎂 Возраст: '.implode(' · ', $parts);
            }

            $gender = $audience['gender'] ?? [];
            $male = (int) ($gender['male'] ?? 0);
            $female = (int) ($gender['female'] ?? 0);

            if ($male + $female > 0) {
                $lines[] = '👫 Пол: 👨 '.$male.' · 👩 '.$female;
            }
        } else {
            $lines[] = '';
            $lines[] = '🔒 Кто вас лайкает (интересы, возраст, пол) — на <b>PRO</b>. Откройте /plan.';
        }

        $visitors = $stats['visitors'];

        if (is_array($visitors)) {
            $lines[] = '';
            $lines[] = '🕵️ <b>Гости страницы (Premium)</b>';

            if ($visitors === []) {
                $lines[] = 'Пока никто не заходил — поделитесь ссылкой на профиль!';
            } else {
                foreach (array_slice($visitors, 0, 5) as $visitor) {
                    $name = self::esc((string) ($visitor['name'] ?? 'Без имени'));
                    $age = $visitor['age'] !== null ? ', '.$visitor['age'] : '';
                    $lines[] = '• <b>'.$name.'</b>'.$age;
                }

                $rest = count($visitors) - min(5, count($visitors));

                if ($rest > 0) {
                    $lines[] = '…и ещё <b>'.$rest.'</b> — полный список в приложении и в CSV.';
                }
            }
        } elseif ($tier === 'free') {
            $lines[] = '';
            $lines[] = '🕵️ Конкретных гостей видно на <b>Premium</b>. Откройте /plan.';
        }

        if ($tier === 'free') {
            $lines[] = '';
            $lines[] = '💡 PRO покажет интересы и возраст поклонников, Premium — конкретных гостей с анкетами.';
        }

        $lines[] = '';
        $lines[] = '📥 Выгрузка CSV со всем доступным по тарифу — команда /export.';

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
     * Запасной текст статистики, если ProfileStatsService упал.
     *
     * @param User $user владелец
     * @return string HTML-текст
     */
    private static function fallbackStatsText(User $user): string
    {
        $fresh = $user->fresh() ?? $user;

        $plan = (string) ($fresh->effectivePlan() ?? 'free');
        $planLabel = self::planLabel($plan);

        $level = (int) ($fresh->level ?? 1);
        $reputation = (int) ($fresh->reputation_score ?? 0);

        $admirers = self::admirers($fresh);
        $matches = self::matches($fresh);
        $unread = self::unreadCount($fresh);

        $totalUsers = self::totalUsers();

        $lines = [];
        $lines[] = '📊 <b>Ваша статистика</b>';

        if ($totalUsers > 0) {
            $lines[] = '👥 Нас в приложении уже: <b>'.$totalUsers.'</b>';
        }

        $lines[] = '';
        $lines[] = '💎 Тариф: <b>'.$planLabel.'</b>';
        $lines[] = '⭐ Уровень: <b>'.$level.'</b> · Репутация: <b>'.$reputation.'</b>';
        $lines[] = '💞 Лайков анкеты: <b>'.$admirers['total'].'</b>';
        $lines[] = '🎉 Мэтчей: <b>'.$matches['total'].'</b>';
        $lines[] = '💬 Непрочитанных: <b>'.$unread.'</b>';

        return implode("\n", $lines);
    }

    /**
     * Короткая подпись минут: 5 мин, 1 ч 20 мин, 2 ч.
     *
     * @param int $minutes
     * @return string
     */
    private static function minutesLabel(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes.' мин';
        }

        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;

        if ($rest === 0) {
            return $hours.' ч';
        }

        return $hours.' ч '.$rest.' мин';
    }

    /**
     * Экранировать текст под parse_mode=HTML.
     *
     * @param string $text сырой текст
     * @return string
     */
    private static function esc(string $text): string
    {
        return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    /**
     * Сколько людей в приложении (без технического гостя).
     *
     * Кэшируем на 10 минут: цифра для витрины, а не realtime-счётчик.
     *
     * @return int
     */
    public static function totalUsers(): int
    {
        try {
            return (int) \Illuminate\Support\Facades\Cache::remember('tg:total_users', 600, function (): int {
                return (int) User::where('id', '!=', User::GHOST_USER_ID)->count();
            });
        } catch (\Throwable) {
            return 0;
        }
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
