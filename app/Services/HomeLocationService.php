<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Координаты домашней точки по городу и стране.
 *
 * Нужен для свайпов: если человек не дал геолокацию, но указал
 * город/страну при регистрации или в профиле, дистанцию считаем
 * по центру этого города. Nominatim вызывается только при
 * отсутствии координат, результат кэшируется на 30 дней, поэтому
 * повторные заходы в профиль/ленту не создают внешних запросов.
 */
class HomeLocationService
{
    /**
     * TTL кэша координат места.
     */
    private const CACHE_DAYS = 30;

    /**
     * Таймаут запроса к Nominatim, секунды.
     */
    private const TIMEOUT_SECONDS = 5;

    /**
     * Подставить координаты города/страны, если их ещё нет.
     *
     * Ничего не делает, когда точка уже задана (геолокация точнее
     * центра города), и молча возвращает false при пустом запросе
     * или сбое внешнего сервиса — сохранение профиля не должно
     * падать из-за геокодера.
     *
     * @param User $user пользователь, которому нужна домашняя точка
     * @return bool true когда координаты появились
     */
    public function ensureCoordinates(User $user): bool
    {
        if ($user->home_lat !== null && $user->home_lng !== null) {
            return true;
        }

        $query = $this->queryFor($user->home_city, $user->country ?: $user->country_code);

        if ($query === null) {
            return false;
        }

        $coords = $this->coordinatesFor($query);

        if ($coords === null) {
            return false;
        }

        $user->forceFill([
            'home_lat' => $coords['lat'],
            'home_lng' => $coords['lng'],
        ])->saveQuietly();

        return true;
    }

    /**
     * Человекочитаемый запрос для геокодера.
     *
     * @param string|null $city город из профиля
     * @param string|null $country страна или её код
     * @return string|null null когда нечего искать
     */
    public function queryFor(?string $city, ?string $country): ?string
    {
        $parts = array_values(array_filter([
            trim((string) $city),
            trim((string) $country),
        ], fn (string $part): bool => $part !== ''));

        if ($parts === []) {
            return null;
        }

        return implode(', ', $parts);
    }

    /**
     * Координаты места через Nominatim с кэшем.
     *
     * @param string $query «Минск, Беларусь»
     * @return array{lat:float,lng:float}|null
     */
    public function coordinatesFor(string $query): ?array
    {
        $normalized = mb_strtolower(trim((string) preg_replace('/\s+/u', ' ', $query)));

        if ($normalized === '') {
            return null;
        }

        $key = 'geo:place:'.sha1($normalized);
        $cached = Cache::get($key);

        if (is_array($cached)) {
            return $cached;
        }

        if ($cached === 'none') {
            return null;
        }

        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->connectTimeout(2)
                ->withHeaders([
                    'User-Agent' => config('app.name').' home-location ('.config('app.url').')',
                    'Accept' => 'application/json',
                ])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'format' => 'jsonv2',
                    'limit' => 1,
                    'accept-language' => 'ru',
                    'q' => $query,
                ]);

            $first = $response->successful() ? (($response->json() ?? [])[0] ?? null) : null;

            if (! is_array($first)) {
                Cache::put($key, 'none', now()->addDay());

                return null;
            }

            $lat = (float) ($first['lat'] ?? 0);
            $lng = (float) ($first['lon'] ?? 0);

            if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
                Cache::put($key, 'none', now()->addDay());

                return null;
            }

            if ($lat === 0.0 && $lng === 0.0) {
                Cache::put($key, 'none', now()->addDay());

                return null;
            }

            $coords = ['lat' => round($lat, 7), 'lng' => round($lng, 7)];
            Cache::put($key, $coords, now()->addDays(self::CACHE_DAYS));

            return $coords;
        } catch (\Throwable $e) {
            Log::warning('HomeLocationService failed: '.$e->getMessage(), [
                'query' => $query,
            ]);

            return null;
        }
    }
}
