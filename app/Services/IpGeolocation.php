<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class IpGeolocation
{
    public static function lookup(?string $ip): array
    {
        $out = ['country' => null, 'country_code' => null, 'city' => null];
        $ip = trim((string) $ip);
        if ($ip === '' || self::isPrivate($ip)) return $out;
        try {
            return Cache::remember('ipgeo:'.$ip, now()->addDays(30), function () use ($ip, $out) {
                try {
                    $r = Http::timeout(3)->withHeaders(['User-Agent' => config('app.name').' ipgeo'])->get('http://ip-api.com/json/'.urlencode($ip), [
                        'fields' => 'status,country,countryCode,city',
                    ]);
                    if (!$r->successful()) return $out;
                    $d = $r->json();
                    if (($d['status'] ?? null) !== 'success') return $out;
                    return [
                        'country' => $d['country'] ?? null,
                        'country_code' => isset($d['countryCode']) ? mb_strtolower((string) $d['countryCode']) : null,
                        'city' => $d['city'] ?? null,
                    ];
                } catch (\Throwable $e) {
                    Log::warning('ipgeo failed: '.$e->getMessage());
                    return $out;
                }
            });
        } catch (\Throwable) {
            return $out;
        }
    }

    private static function isPrivate(string $ip): bool
    {
        if ($ip === '127.0.0.1' || $ip === '::1') return true;
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) return true;
        return false;
    }
}
