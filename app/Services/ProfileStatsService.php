<?php

namespace App\Services;

use App\Models\AppTimeLog;
use App\Models\ProfileView;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Статистика профиля по тарифам.
 *
 * Free — база: время в приложении (сегодня/неделя/месяц),
 * лайки входящие за неделю и месяц, просмотры профиля,
 * мэтчи и непрочитанные.
 * Pro — всё из Free + разрез «кто лайкает»: топ интересов
 * лайкнувших, возрастные корзины и соотношение полов.
 * Premium/Business/админ — всё из Pro + конкретные гости:
 * кто заходил на страницу (анкета + кнопка написать).
 *
 * Время в приложении копит heartbeat (accumulateHeartbeat),
 * просмотры — recordView при открытии чужого профиля.
 */
class ProfileStatsService
{
    /**
     * Записать просмотр профиля с дедупом раз в сутки.
     *
     * Свои просмотры не пишем. Ошибки глушим — статистика
     * не должна ронять страницу профиля.
     *
     * @param User|null $viewer кто смотрит (null — гость)
     * @param int $viewedId чью страницу открыли
     * @return void
     */
    public static function recordView(?User $viewer, int $viewedId): void
    {
        $viewerId = $viewer?->id;

        if ($viewerId !== null && (int) $viewerId === (int) $viewedId) {
            return;
        }

        try {
            $today = Carbon::today();

            $query = ProfileView::where('viewed_id', $viewedId)
                ->whereDate('created_at', $today);

            if ($viewerId === null) {
                $query->whereNull('viewer_id');
            } else {
                $query->where('viewer_id', $viewerId);
            }

            if ($query->exists()) {
                return;
            }

            ProfileView::create([
                'viewed_id' => $viewedId,
                'viewer_id' => $viewerId,
                'created_at' => now(),
            ]);

            if ($viewer !== null) {
                self::notifyOwner($viewer, $viewedId);
            }
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Уведомить владельца страницы о госте (PRO и выше + тумблер).
     *
     * Колокольчик (realtime + пуш через UserNotifier) и письмо бота —
     * только если у владельца платный тариф и включён
     * notify_profile_visitors. Гости без аккаунта уведомлений не дают.
     * Ошибки глушим: статистика не роняет страницу профиля.
     *
     * @param User $viewer кто зашёл
     * @param int $viewedId чью страницу открыли
     * @return void
     */
    private static function notifyOwner(User $viewer, int $viewedId): void
    {
        try {
            $owner = User::find($viewedId);

            if ($owner === null) {
                return;
            }

            if (! $owner->canUseVisitorNotifications()) {
                return;
            }

            if (! (bool) ($owner->notify_profile_visitors ?? true)) {
                return;
            }

            UserNotifier::send($owner, new \App\Notifications\ProfileVisitedNotification($viewer, (int) $owner->id));
        } catch (\Throwable) {
            return;
        }

        try {
            TelegramNotifier::profileVisited($viewer, $owner->fresh() ?? $owner);
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Докопить время онлайна по heartbeat.
     *
     * Вызывать ДО обновления last_seen_at: дельта между
     * прошлым last_seen_at и now (не больше 5 минут) падает
     * в сегодняшний AppTimeLog.
     *
     * @param User $user владелец heartbeat
     * @return void
     */
    public static function accumulateHeartbeat(User $user): void
    {
        try {
            $last = $user->last_seen_at;

            if ($last === null) {
                return;
            }

            $delta = now()->diffInSeconds(Carbon::parse($last));

            if ($delta <= 0 || $delta > 300) {
                return;
            }

            $today = Carbon::today()->toDateString();

            $log = AppTimeLog::firstOrNew([
                'user_id' => (int) $user->id,
                'day' => $today,
            ]);

            $log->seconds = (int) ($log->seconds ?? 0) + (int) $delta;
            $log->save();
        } catch (\Throwable) {
            return;
        }
    }

    /**
     * Сводка статистики с гейтом по тарифу.
     *
     * @param User $user чей профиль считаем
     * @return array<string, mixed>
     */
    public static function summary(User $user): array
    {
        $fresh = $user->fresh() ?? $user;
        $userId = (int) $fresh->id;
        $plan = (string) ($fresh->effectivePlan() ?? 'free');

        $isPro = in_array($plan, ['pro', 'premium', 'business'], true) || $fresh->isModerator();
        $isTop = in_array($plan, ['premium', 'business'], true) || $fresh->isModerator();

        $now = now();
        $weekAgo = $now->copy()->subDays(7);
        $monthAgo = $now->copy()->subDays(30);

        $likes = self::likesCount($userId, $weekAgo, $monthAgo);
        $views = self::viewsCount($userId, $weekAgo, $monthAgo);
        $time = self::timeSpent($userId);
        $matches = self::matchesCount($userId);
        $unread = self::unreadCount($fresh);
        $daily = self::dailyTable($userId, $time);

        $result = [
            'plan' => $plan,
            'tier' => $isTop ? 'premium' : ($isPro ? 'pro' : 'free'),
            'likes' => $likes,
            'views' => $views,
            'time' => $time,
            'matches_total' => $matches,
            'unread' => $unread,
            'daily' => $daily,
            'audience' => null,
            'visitors' => null,
        ];

        if ($isPro) {
            $result['audience'] = self::audience($userId, $monthAgo);
        }

        if ($isTop) {
            $result['visitors'] = self::visitors($fresh, 20);
        }

        return $result;
    }

    /**
     * Входящие лайки: всего, за неделю, за месяц.
     *
     * @param int $userId
     * @param Carbon $weekAgo
     * @param Carbon $monthAgo
     * @return array{total:int,week:int,month:int}
     */
    private static function likesCount(int $userId, Carbon $weekAgo, Carbon $monthAgo): array
    {
        try {
            $base = DB::table('swipe_actions')
                ->where('liked_id', $userId)
                ->where('action', 'like');

            $total = (int) (clone $base)->count();
            $week = (int) (clone $base)->where('created_at', '>=', $weekAgo)->count();
            $month = (int) (clone $base)->where('created_at', '>=', $monthAgo)->count();
        } catch (\Throwable) {
            return ['total' => 0, 'week' => 0, 'month' => 0];
        }

        return ['total' => $total, 'week' => $week, 'month' => $month];
    }

    /**
     * Просмотры страницы профиля.
     *
     * @param int $userId
     * @param Carbon $weekAgo
     * @param Carbon $monthAgo
     * @return array{total:int,week:int,month:int}
     */
    private static function viewsCount(int $userId, Carbon $weekAgo, Carbon $monthAgo): array
    {
        try {
            $total = (int) ProfileView::where('viewed_id', $userId)->count();
            $week = (int) ProfileView::where('viewed_id', $userId)->where('created_at', '>=', $weekAgo)->count();
            $month = (int) ProfileView::where('viewed_id', $userId)->where('created_at', '>=', $monthAgo)->count();
        } catch (\Throwable) {
            return ['total' => 0, 'week' => 0, 'month' => 0];
        }

        return ['total' => $total, 'week' => $week, 'month' => $month];
    }

    /**
     * Время в приложении: сегодня, неделя, месяц + по дням.
     *
     * @param int $userId
     * @return array{today_min:int,week_min:int,month_min:int,daily:array<int, array{day:string,min:int}>}
     */
    private static function timeSpent(int $userId): array
    {
        try {
            $today = Carbon::today()->toDateString();
            $weekStart = Carbon::today()->subDays(6)->toDateString();
            $monthStart = Carbon::today()->subDays(29)->toDateString();

            $rows = AppTimeLog::where('user_id', $userId)
                ->where('day', '>=', $monthStart)
                ->orderBy('day')
                ->get(['day', 'seconds']);
        } catch (\Throwable) {
            return ['today_min' => 0, 'week_min' => 0, 'month_min' => 0, 'daily' => []];
        }

        $byDay = [];

        foreach ($rows as $row) {
            $day = (string) ($row->day instanceof \DateTimeInterface ? $row->day->format('Y-m-d') : $row->day);
            $byDay[$day] = (int) $row->seconds;
        }

        $todaySec = (int) ($byDay[$today] ?? 0);

        $weekSec = 0;
        $monthSec = 0;

        foreach ($byDay as $day => $sec) {
            if ($day >= $weekStart) {
                $weekSec += $sec;
            }

            $monthSec += $sec;
        }

        $toMin = fn (int $sec): int => (int) round($sec / 60);

        $daily = [];

        foreach ($byDay as $day => $sec) {
            $daily[] = ['day' => $day, 'min' => $toMin($sec)];
        }

        return [
            'today_min' => $toMin($todaySec),
            'week_min' => $toMin($weekSec),
            'month_min' => $toMin($monthSec),
            'daily' => $daily,
        ];
    }

    /**
     * Таблица динамики по дням: минуты в приложении, лайки, просмотры.
     *
     * Последние 14 дней, включая сегодня. Пустые дни тоже отдаём
     * нулями — фронт рисует ровную таблицу без дыр.
     *
     * @param int $userId
     * @param array{today_min:int,week_min:int,month_min:int,daily:array<int, array{day:string,min:int}>} $time уже посчитанное время
     * @return array<int, array{day:string,min:int,likes:int,views:int}>
     */
    private static function dailyTable(int $userId, array $time): array
    {
        $days = [];

        for ($i = 13; $i >= 0; $i--) {
            $day = Carbon::today()->subDays($i)->toDateString();
            $days[$day] = ['day' => $day, 'min' => 0, 'likes' => 0, 'views' => 0];
        }

        foreach ($time['daily'] ?? [] as $row) {
            $day = (string) ($row['day'] ?? '');

            if (isset($days[$day])) {
                $days[$day]['min'] = (int) ($row['min'] ?? 0);
            }
        }

        try {
            $since = Carbon::today()->subDays(13)->startOfDay();

            $likeRows = DB::table('swipe_actions')
                ->where('liked_id', $userId)
                ->where('action', 'like')
                ->where('created_at', '>=', $since)
                ->selectRaw('DATE(created_at) as day, COUNT(*) as total')
                ->groupBy('day')
                ->pluck('total', 'day')
                ->all();

            foreach ($likeRows as $day => $total) {
                $key = (string) $day;

                if (isset($days[$key])) {
                    $days[$key]['likes'] = (int) $total;
                }
            }
        } catch (\Throwable) {
        }

        try {
            $since = Carbon::today()->subDays(13)->startOfDay();

            $viewRows = ProfileView::where('viewed_id', $userId)
                ->where('created_at', '>=', $since)
                ->selectRaw('DATE(created_at) as day, COUNT(*) as total')
                ->groupBy('day')
                ->pluck('total', 'day')
                ->all();

            foreach ($viewRows as $day => $total) {
                $key = (string) $day;

                if (isset($days[$key])) {
                    $days[$key]['views'] = (int) $total;
                }
            }
        } catch (\Throwable) {
        }

        return array_values($days);
    }

    /**
     * Сколько мэтчей у пользователя.
     *
     * @param int $userId
     * @return int
     */
    private static function matchesCount(int $userId): int
    {
        try {
            return (int) DB::table('dating_matches')
                ->where('user_a', $userId)
                ->orWhere('user_b', $userId)
                ->count();
        } catch (\Throwable) {
            try {
                return (int) DB::table('dating_matches')
                    ->where('user_a_id', $userId)
                    ->orWhere('user_b_id', $userId)
                    ->count();
            } catch (\Throwable) {
                return 0;
            }
        }
    }

    /**
     * Непрочитанные сообщения.
     *
     * @param User $user
     * @return int
     */
    private static function unreadCount(User $user): int
    {
        try {
            return (int) $user->unreadMessagesCount();
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * PRO-разрез: какой контингент лайкает (интересы, возраст, пол).
     *
     * @param int $userId
     * @param Carbon $since
     * @return array{interests:array<int, array{tag:string,count:int}>,age_buckets:array<string,int>,gender:array<string,int>,total:int}
     */
    private static function audience(int $userId, Carbon $since): array
    {
        try {
            $likerIds = DB::table('swipe_actions')
                ->where('liked_id', $userId)
                ->where('action', 'like')
                ->where('created_at', '>=', $since)
                ->orderByDesc('id')
                ->limit(500)
                ->pluck('liker_id')
                ->map(fn ($id): int => (int) $id)
                ->unique()
                ->values()
                ->all();
        } catch (\Throwable) {
            return ['interests' => [], 'age_buckets' => [], 'gender' => [], 'total' => 0];
        }

        if ($likerIds === []) {
            return ['interests' => [], 'age_buckets' => [], 'gender' => [], 'total' => 0];
        }

        try {
            $likers = User::whereIn('id', $likerIds)
                ->get(['id', 'gender', 'birth_date', 'dating_interests']);
        } catch (\Throwable) {
            return ['interests' => [], 'age_buckets' => [], 'gender' => [], 'total' => 0];
        }

        $interestCounts = [];
        $buckets = ['18-24' => 0, '25-34' => 0, '35-44' => 0, '45+' => 0, 'unknown' => 0];
        $genders = ['male' => 0, 'female' => 0, 'unknown' => 0];

        foreach ($likers as $liker) {
            $interests = $liker->dating_interests;

            if (is_string($interests)) {
                $decoded = json_decode($interests, true);
                $interests = is_array($decoded) ? $decoded : [];
            }

            if (is_array($interests)) {
                foreach ($interests as $tag) {
                    $clean = mb_strtolower(trim((string) $tag));

                    if ($clean === '') {
                        continue;
                    }

                    $interestCounts[$clean] = ($interestCounts[$clean] ?? 0) + 1;
                }
            }

            $gender = trim((string) ($liker->gender ?? ''));

            if ($gender === 'male' || $gender === 'female') {
                $genders[$gender]++;
            } else {
                $genders['unknown']++;
            }

            $age = null;

            try {
                $age = $liker->age;
            } catch (\Throwable) {
                $age = null;
            }

            if ($age === null) {
                $buckets['unknown']++;
            } elseif ($age < 25) {
                $buckets['18-24']++;
            } elseif ($age < 35) {
                $buckets['25-34']++;
            } elseif ($age < 45) {
                $buckets['35-44']++;
            } else {
                $buckets['45+']++;
            }
        }

        arsort($interestCounts);

        $top = [];

        foreach (array_slice($interestCounts, 0, 12, true) as $tag => $count) {
            $top[] = ['tag' => (string) $tag, 'count' => (int) $count];
        }

        return [
            'interests' => $top,
            'age_buckets' => $buckets,
            'gender' => $genders,
            'total' => count($likerIds),
        ];
    }

    /**
     * Premium-гости: конкретные профили, заходившие на страницу.
     *
     * @param User $owner владелец страницы
     * @param int $limit
     * @return array<int, array<string, mixed>>
     */
    private static function visitors(User $owner, int $limit = 20): array
    {
        try {
            $views = ProfileView::where('viewed_id', (int) $owner->id)
                ->whereNotNull('viewer_id')
                ->orderByDesc('id')
                ->limit($limit * 2)
                ->get(['viewer_id', 'created_at']);
        } catch (\Throwable) {
            return [];
        }

        $seen = [];
        $ordered = [];

        foreach ($views as $view) {
            $viewerId = (int) $view->viewer_id;

            if ($viewerId <= 0 || isset($seen[$viewerId])) {
                continue;
            }

            $seen[$viewerId] = true;
            $ordered[$viewerId] = $view->created_at;
        }

        $ids = array_keys($seen);

        if ($ids === []) {
            return [];
        }

        $users = User::whereIn('id', array_slice($ids, 0, $limit))
            ->get(['id', 'name', 'profile_slug', 'gender', 'birth_date', 'avatar_path', 'telegram_photo_url', 'dating_goal', 'dating_about', 'dating_interests'])
            ->keyBy('id');

        $result = [];

        foreach (array_slice($ids, 0, $limit) as $id) {
            $candidate = $users->get($id);

            if ($candidate === null) {
                continue;
            }

            $canMessage = $owner->canMessageUser($candidate);

            $result[] = [
                'id' => (int) $candidate->id,
                'name' => (string) ($candidate->name ?? ''),
                'profile_slug' => $candidate->profile_slug,
                'avatar_url' => $candidate->avatar_url,
                'age' => $candidate->age,
                'gender' => $candidate->gender,
                'goal' => $candidate->dating_goal,
                'about' => $candidate->dating_about,
                'interests' => $candidate->dating_interests ?? [],
                'viewed_at' => $ordered[$id]?->toISOString(),
                'can_message' => $canMessage,
                'can_message_reason' => $canMessage ? null : $owner->messageBlockReason($candidate),
            ];
        }

        return $result;
    }

    /**
     * Выгрузка статистики в CSV (разделитель `;`, UTF-8 с BOM для Excel).
     *
     * Free — только своя база, Pro — плюс аудитория, Premium — плюс гости.
     *
     * @param User $user
     * @return string содержимое CSV
     */
    public static function exportCsv(User $user): string
    {
        $data = self::summary($user);

        $lines = [];
        $lines[] = "\xEF\xBB\xBFраздел;метрика;значение";

        $likes = $data['likes'];
        $views = $data['views'];
        $time = $data['time'];

        $lines[] = 'профиль;лайков всего;'.$likes['total'];
        $lines[] = 'профиль;лайков за неделю;'.$likes['week'];
        $lines[] = 'профиль;лайков за месяц;'.$likes['month'];
        $lines[] = 'профиль;просмотров всего;'.$views['total'];
        $lines[] = 'профиль;просмотров за неделю;'.$views['week'];
        $lines[] = 'профиль;просмотров за месяц;'.$views['month'];
        $lines[] = 'профиль;мэтчей всего;'.$data['matches_total'];
        $lines[] = 'время;минут сегодня;'.$time['today_min'];
        $lines[] = 'время;минут за неделю;'.$time['week_min'];
        $lines[] = 'время;минут за месяц;'.$time['month_min'];

        foreach ($time['daily'] as $row) {
            $lines[] = 'время по дням;'.$row['day'].';'.$row['min'].' мин';
        }

        $audience = $data['audience'];

        if (is_array($audience)) {
            foreach ($audience['interests'] as $item) {
                $tag = str_replace(';', ',', (string) $item['tag']);
                $lines[] = 'аудитория;интерес '.$tag.';'.$item['count'];
            }

            foreach ($audience['age_buckets'] as $bucket => $count) {
                $lines[] = 'аудитория;возраст '.$bucket.';'.$count;
            }

            foreach ($audience['gender'] as $gender => $count) {
                $lines[] = 'аудитория;пол '.$gender.';'.$count;
            }
        }

        $visitors = $data['visitors'];

        if (is_array($visitors)) {
            foreach ($visitors as $visitor) {
                $name = str_replace(';', ',', (string) ($visitor['name'] ?? ''));
                $lines[] = 'гости;'.$name.' (id '.$visitor['id'].');'.($visitor['viewed_at'] ?? '');
            }
        }

        return implode("\n", $lines)."\n";
    }
}
