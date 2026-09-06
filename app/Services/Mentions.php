<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Support\Facades\DB;

class Mentions
{
    public static function extractIds(?string $content, int $excludeId = 0): array
    {
        if (!is_string($content) || $content === '' || !str_contains($content, '@')) return [];
        if (!preg_match_all('/@([^@\n\r]+)/u', $content, $m)) return [];
        $variants = [];
        foreach ($m[1] as $raw) {
            $candidate = self::clean($raw);
            if ($candidate === '') continue;
            $words = preg_split('/\s+/u', $candidate);
            if (!$words) continue;
            $take = array_slice($words, 0, 4);
            while ($take) {
                $v = rtrim(implode(' ', $take), " \t.,!?;:()[]{}\"<>'«»„“”…—–-");
                if ($v !== '') $variants[] = mb_strtolower($v);
                array_pop($take);
            }
        }
        $variants = array_values(array_unique($variants));
        if (!$variants) return [];
        $rows = User::query()
            ->whereIn(DB::raw('LOWER(name)'), $variants)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();
        return array_values(array_unique(array_filter($rows, fn ($id) => $id !== $excludeId)));
    }

    public static function notifyableIds(array $ids, int $actorId): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $ids = array_values(array_filter($ids, fn ($id) => $id > 0 && $id !== $actorId));
        if (!$ids) return [];
        $blocked = UserBlock::where(function ($q) use ($ids, $actorId) {
            $q->where(fn ($x) => $x->where('blocker_id', $actorId)->whereIn('blocked_id', $ids))
              ->orWhere(fn ($x) => $x->where('blocked_id', $actorId)->whereIn('blocker_id', $ids));
        })->get()->flatMap(fn ($b) => [(int) $b->blocker_id, (int) $b->blocked_id])->unique()->all();
        return array_values(array_filter($ids, fn ($id) => !in_array($id, $blocked, true)));
    }

    private static function clean(string $raw): string
    {
        $s = trim(preg_replace('/\s+/u', ' ', $raw) ?? '');
        $s = rtrim($s, " \t.,!?;:()[]{}\"<>'«»„“”…—–-");
        if (mb_strlen($s) > 60) $s = mb_substr($s, 0, 60);
        return $s;
    }
}
