<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class CountryResolver
{
    public static function normalizeCode(?string $code): ?string
    {
        if (!$code) return null;
        $code = mb_strtolower(trim($code));
        return $code !== '' ? $code : null;
    }

    public static function normalizeName(?string $name): ?string
    {
        if (!$name) return null;
        $name = trim(preg_replace('/\s+/', ' ', (string) $name));
        return $name !== '' ? $name : null;
    }

    public static function sameCountry(?string $aCode, ?string $aName, ?string $bCode, ?string $bName): bool
    {
        $aCode = self::normalizeCode($aCode);
        $bCode = self::normalizeCode($bCode);
        if ($aCode && $bCode) return $aCode === $bCode;
        $aName = $aName ? mb_strtolower(trim((string) $aName)) : null;
        $bName = $bName ? mb_strtolower(trim((string) $bName)) : null;
        if ($aName && $bName) return $aName === $bName;
        return false;
    }

    public static function fromCoords(float $lat, float $lng): ?array
    {
        if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) return null;
        $key = sprintf('country:%s:%s', round($lat, 2), round($lng, 2));
        return Cache::remember($key, now()->addDays(30), function () use ($lat, $lng) {
            try {
                $r = Http::timeout(6)->withHeaders(['User-Agent' => config('app.name').' country-guard'])->get('https://nominatim.openstreetmap.org/reverse', [
                    'format' => 'json',
                    'lat' => $lat,
                    'lon' => $lng,
                    'zoom' => 3,
                    'accept-language' => 'ru',
                ]);
                if (!$r->successful()) return null;
                $d = $r->json();
                $a = $d['address'] ?? [];
                $country = self::normalizeName($a['country'] ?? null);
                $code = self::normalizeCode($a['country_code'] ?? null);
                if (!$country && !$code) return null;
                return ['country' => $country, 'country_code' => $code];
            } catch (\Throwable $e) {
                Log::warning('CountryResolver failed: '.$e->getMessage());
                return null;
            }
        });
    }

    public static function expectedFor(\App\Models\User $user, ?float $userLat = null, ?float $userLng = null): ?array
    {
        if ($user->country || $user->country_code) {
            return ['country' => $user->country, 'country_code' => self::normalizeCode($user->country_code)];
        }
        $lat = $userLat ?? ($user->home_lat !== null ? (float) $user->home_lat : null);
        $lng = $userLng ?? ($user->home_lng !== null ? (float) $user->home_lng : null);
        if ($lat === null || $lng === null) return null;
        return self::fromCoords($lat, $lng);
    }

    public static function assertPinAllowed(\App\Models\User $user, float $pinLat, float $pinLng, ?float $userLat = null, ?float $userLng = null): void
    {
        if ($user->isAdmin()) return;
        $expected = self::expectedFor($user, $userLat, $userLng);
        if (!$expected) {
            $pin = self::fromCoords($pinLat, $pinLng);
            if ($pin) {
                $user->forceFill(['country' => $pin['country'], 'country_code' => $pin['country_code']])->save();
            }
            return;
        }
        $pin = self::fromCoords($pinLat, $pinLng);
        if (!$pin) return;
        if (!self::sameCountry($expected['country_code'] ?? null, $expected['country'] ?? null, $pin['country_code'] ?? null, $pin['country'] ?? null)) {
            $home = $expected['country'] ?? $expected['country_code'] ?? 'стране проживания';
            $there = $pin['country'] ?? $pin['country_code'] ?? 'другой стране';
            abort(422, "Операция запрещена — карта ограничена страной проживания ({$home}). Пин находится в: {$there}.");
        }
    }

    public static function assertResidenceAllowed(?string $country, ?string $code, mixed $lat, mixed $lng): void
    {
        $country = self::normalizeName($country);
        $code = self::normalizeCode($code);
        if (!$country && !$code) return;
        if ($lat === null || $lng === null || $lat === '' || $lng === '') return;
        if (!is_numeric($lat) || !is_numeric($lng)) return;
        $detected = self::fromCoords((float) $lat, (float) $lng);
        if (!$detected) return;
        if (self::sameCountry($code, $country, $detected['country_code'] ?? null, $detected['country'] ?? null)) return;
        $declared = $country ?? $code;
        $there = $detected['country'] ?? $detected['country_code'] ?? 'другая страна';
        throw ValidationException::withMessages(['country' => ["Страна «{$declared}» не совпадает с геолокацией ({$there}). Сохранение запрещено — укажите страну, где вы находитесь."]]);
    }
}
