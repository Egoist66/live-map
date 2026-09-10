<?php

namespace App\Services;

use App\Models\User;

/**
 * Домашняя зона пользователя: центр + радиус видимости пинов.
 *
 * Центр: реальная геопозиция (user_lat/user_lng), если гео включено,
 * иначе статичный дом (home_lat/home_lng из профиля).
 * Радиус: home_radius_km, обрезанный лимитом тарифа (free — 10 км).
 * Админ ограничений не имеет.
 */
class HomeZoneService
{
    /**
     * @param User $user
     * @param float|null $liveLat реальная геопозиция (null — гео выключено)
     * @param float|null $liveLng
     * @return array{lat: float, lng: float, radiusKm: int, live: bool}|null
     */
    public static function zoneFor(User $user, ?float $liveLat = null, ?float $liveLng = null): ?array
    {
        if ($liveLat !== null && $liveLng !== null) {
            return [
                'lat' => $liveLat,
                'lng' => $liveLng,
                'radiusKm' => $user->homeZoneRadiusKm(),
                'live' => true,
            ];
        }

        if ($user->home_lat === null || $user->home_lng === null) {
            return null;
        }

        return [
            'lat' => (float) $user->home_lat,
            'lng' => (float) $user->home_lng,
            'radiusKm' => $user->homeZoneRadiusKm(),
            'live' => false,
        ];
    }

    /**
     * Расстояние по гаверсинусу в км.
     */
    public static function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earth = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * Запрещает операцию вне зоны (создание/просмотр чужих пинов).
     *
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException 422
     */
    public static function assertInsideZone(User $user, float $pinLat, float $pinLng, ?float $liveLat = null, ?float $liveLng = null): void
    {
        if ($user->isAdmin()) {
            return;
        }

        $zone = self::zoneFor($user, $liveLat, $liveLng);

        if ($zone === null) {
            return;
        }

        $distance = self::distanceKm($zone['lat'], $zone['lng'], $pinLat, $pinLng);

        if ($distance <= $zone['radiusKm']) {
            return;
        }

        $where = $zone['live'] ? 'вашей текущей геопозиции' : 'вашего дома';
        $dist = number_format($distance, 1, ',', ' ');
        $radius = $zone['radiusKm'];

        abort(422, "Операция запрещена — точка вне вашей зоны ({$dist} км от {$where}, радиус {$radius} км). Free — до 10 км, больше — тариф Pro.");
    }

    /**
     * Проверка для чтения (show): свой пин и админ — всегда можно.
     */
    public static function isOutsideZone(User $user, float $pinLat, float $pinLng, ?float $liveLat = null, ?float $liveLng = null): bool
    {
        if ($user->isAdmin()) {
            return false;
        }

        $zone = self::zoneFor($user, $liveLat, $liveLng);

        if ($zone === null) {
            return false;
        }

        return self::distanceKm($zone['lat'], $zone['lng'], $pinLat, $pinLng) > $zone['radiusKm'];
    }
}
