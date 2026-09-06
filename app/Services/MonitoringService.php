<?php

namespace App\Services;

use App\Models\Pin;
use App\Models\Report;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class MonitoringService
{
    public const ONLINE_MINUTES = 3;

    public static function onlineThreshold(): \Carbon\Carbon
    {
        return now()->subMinutes(self::ONLINE_MINUTES);
    }

    public static function isOnline(?\Carbon\Carbon $lastSeen): bool
    {
        if (! $lastSeen) return false;
        return $lastSeen->greaterThanOrEqualTo(self::onlineThreshold());
    }

    public function overview(): array
    {
        return Cache::remember('monitoring:overview', 60, function () {
            $threshold = self::onlineThreshold();
            $today = now()->startOfDay();

            $total = User::count();
            $online = User::where('last_seen_at', '>=', $threshold)->count();
            $onlineVisible = (clone $threshold) ? User::where('last_seen_at', '>=', $threshold)->where('is_invisible', false)->count() : 0;
            $newToday = User::where('created_at', '>=', $today)->count();
            $newWeek = User::where('created_at', '>=', now()->subDays(7))->count();
            $newMonth = User::where('created_at', '>=', now()->subDays(30))->count();
            $activeToday = User::where('last_seen_at', '>=', $today)->count();
            $activeWeek = User::where('last_seen_at', '>=', now()->subDays(7))->count();

            return [
                'total_users' => $total,
                'online_users' => $online,
                'online_visible' => $onlineVisible,
                'online_invisible' => max(0, $online - $onlineVisible),
                'new_today' => $newToday,
                'new_week' => $newWeek,
                'new_month' => $newMonth,
                'active_today' => $activeToday,
                'active_week' => $activeWeek,
                'total_pins' => Pin::count(),
                'active_pins' => Pin::where('status', 'active')->count(),
                'reports_pending' => Report::where('status', 'pending')->count(),
                'plans' => User::select('plan', DB::raw('count(*) as c'))->groupBy('plan')->pluck('c', 'plan'),
                'generated_at' => now()->toISOString(),
            ];
        });
    }

    public function chart(int $days = 14): array
    {
        $days = max(7, min(30, $days));
        $from = now()->subDays($days - 1)->startOfDay();

        $regs = User::where('created_at', '>=', $from)
            ->select(DB::raw('DATE(created_at) as d'), DB::raw('count(*) as c'))
            ->groupBy('d')->pluck('c', 'd')->all();

        $acts = User::where('last_seen_at', '>=', $from)
            ->select(DB::raw('DATE(last_seen_at) as d'), DB::raw('count(*) as c'))
            ->groupBy('d')->pluck('c', 'd')->all();

        $pins = Pin::where('created_at', '>=', $from)
            ->select(DB::raw('DATE(created_at) as d'), DB::raw('count(*) as c'))
            ->groupBy('d')->pluck('c', 'd')->all();

        $baseTotal = User::where('created_at', '<', $from)->count();
        $running = $baseTotal;

        $out = [];
        for ($i = 0; $i < $days; $i++) {
            $date = now()->subDays($days - 1 - $i)->format('Y-m-d');
            $r = (int) ($regs[$date] ?? 0);
            $running += $r;
            $out[] = [
                'date' => $date,
                'label' => now()->subDays($days - 1 - $i)->format('d.m'),
                'registrations' => $r,
                'active' => (int) ($acts[$date] ?? 0),
                'pins' => (int) ($pins[$date] ?? 0),
                'total' => $running,
            ];
        }

        return $out;
    }

    public function chartSummary(int $days = 14): array
    {
        $points = $this->chart($days);
        $sum = fn (string $k) => array_sum(array_column($points, $k));
        $totalRegs = $sum('registrations');
        $totalActive = $sum('active');
        $totalPins = $sum('pins');

        $bestRegs = collect($points)->sortByDesc('registrations')->first();
        $bestActive = collect($points)->sortByDesc('active')->first();

        $prevFrom = now()->subDays($days * 2 - 1)->startOfDay();
        $prevTo = now()->subDays($days)->endOfDay();
        $prevRegs = User::whereBetween('created_at', [$prevFrom, $prevTo])->count();
        $growth = $prevRegs > 0 ? round(($totalRegs - $prevRegs) / $prevRegs * 100, 1) : ($totalRegs > 0 ? 100.0 : 0.0);

        return [
            'days' => $days,
            'from' => $points[0]['date'] ?? null,
            'to' => $points[count($points) - 1]['date'] ?? null,
            'total_registrations' => $totalRegs,
            'avg_registrations' => round($totalRegs / max(1, $days), 1),
            'total_active_hits' => $totalActive,
            'avg_active' => round($totalActive / max(1, $days), 1),
            'total_pins' => $totalPins,
            'avg_pins' => round($totalPins / max(1, $days), 1),
            'best_registrations_day' => $bestRegs ? ['date' => $bestRegs['date'], 'label' => $bestRegs['label'], 'value' => $bestRegs['registrations']] : null,
            'best_active_day' => $bestActive ? ['date' => $bestActive['date'], 'label' => $bestActive['label'], 'value' => $bestActive['active']] : null,
            'prev_period_registrations' => $prevRegs,
            'registrations_growth_pct' => $growth,
            'total_users_now' => User::count(),
        ];
    }

    protected function userRow(User $u, bool $isOnline): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'avatar_path' => $u->avatar_path,
            'avatar_url' => $u->avatar_url,
            'plan' => $u->plan,
            'role' => $u->role,
            'is_admin' => $u->isAdmin(),
            'is_hidden_from_search' => (bool) $u->is_hidden_from_search,
            'is_invisible' => (bool) $u->is_invisible,
            'is_online' => $isOnline,
            'banned_at' => $u->banned_at?->toISOString(),
            'banned_reason' => $u->banned_reason,
            'last_seen_at' => $u->last_seen_at?->toISOString(),
            'created_at' => $u->created_at?->toISOString(),
            'pins_count' => $u->pins_count ?? 0,
        ];
    }

    public function online(int $perPage = 20, ?string $q = null): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $perPage = max(5, min(100, $perPage));
        $threshold = self::onlineThreshold();

        $query = User::withCount('pins')
            ->where('last_seen_at', '>=', $threshold)
            ->orderByDesc('last_seen_at');

        if ($q && strlen(trim($q)) >= 2) {
            $term = trim($q);
            $query->where(fn ($w) => $w->where('name', 'like', "%$term%")->orWhere('email', 'like', "%$term%"));
        }

        return $query->paginate($perPage)->through(fn (User $u) => $this->userRow($u, true));
    }

    public function users(?string $q = null, string $filter = 'all', string $sort = 'last_seen', int $perPage = 20): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $perPage = max(10, min(100, $perPage));
        $threshold = self::onlineThreshold();

        $query = User::withCount('pins');

        if ($q && strlen(trim($q)) >= 1) {
            $term = trim($q);
            $query->where(fn ($w) => $w->where('name', 'like', "%$term%")->orWhere('email', 'like', "%$term%"));
        }

        match ($filter) {
            'online' => $query->where('last_seen_at', '>=', $threshold),
            'new' => $query->where('created_at', '>=', now()->subDays(7)),
            'hidden' => $query->where('is_hidden_from_search', true),
            'admins' => $query->where(fn ($w) => $w->where('is_admin', true)->orWhere('role', 'admin')),
            default => null,
        };

        match ($sort) {
            'newest' => $query->orderByDesc('created_at'),
            'oldest' => $query->orderBy('created_at'),
            'name' => $query->orderBy('name'),
            default => $query->orderByDesc('last_seen_at'),
        };

        return $query->paginate($perPage)->through(fn (User $u) => $this->userRow($u, self::isOnline($u->last_seen_at)));
    }
}
