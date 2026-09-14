<?php

namespace App\Services;

use App\Models\District;
use App\Models\Pin;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Геометрия UDistrict: проверка мазков кисти и жизнь внутри района.
 *
 * Клиент присылает GeoJSON MultiPolygon из утолщённых мазков.
 * Сервис следит, чтобы район целиком лежал в домашней зоне автора,
 * считает центроид и находит пины внутри заливки.
 */
class DistrictService
{
    /**
     * Максимум точек во всей геометрии (защита от гигантских заливок).
     */
    public const MAX_POINTS = 600;

    /**
     * Проверить геометрию и вернуть нормализованный MultiPolygon + центроид.
     *
     * Каждая точка обязана лежать в зоне автора (живая геопозиция,
     * иначе статичный дом — как на фиолетовой заливке карты).
     * Район создаётся только в рамках своей зоны.
     *
     * @param User $owner автор района
     * @param array $geometry сырой GeoJSON MultiPolygon
     * @param float|null $liveLat живая геопозиция автора
     * @param float|null $liveLng живая геопозиция автора
     * @return array{geometry:array,center_lat:float,center_lng:float}
     *
     * @throws \Symfony\Component\HttpKernel\Exception\HttpException 422
     */
    public static function normalizeGeometry(User $owner, array $geometry, ?float $liveLat = null, ?float $liveLng = null): array
    {
        $polygons = $geometry['coordinates'] ?? null;
        $validType = ($geometry['type'] ?? null) === 'MultiPolygon';
        abort_unless($validType && is_array($polygons) && $polygons !== [], 422, 'Район рисуется кистью: зажми Alt и закрась кусочек карты.');

        $zone = HomeZoneService::zoneFor($owner, $liveLat, $liveLng);
        abort_if($zone === null, 422, 'Сначала задайте дом в профиле или включите геолокацию: район создаётся только в рамках своей зоны.');

        $cleanPolygons = [];
        $pointCount = 0;
        $sumLat = 0.0;
        $sumLng = 0.0;

        foreach ($polygons as $polygon) {
            if (!is_array($polygon) || $polygon === []) {
                continue;
            }
            $cleanRings = [];
            foreach ($polygon as $ring) {
                if (!is_array($ring) || count($ring) < 4) {
                    continue;
                }
                $cleanRing = [];
                foreach ($ring as $point) {
                    if (!is_array($point) || count($point) < 2) {
                        continue;
                    }
                    $lng = (float) $point[0];
                    $lat = (float) $point[1];
                    abort_unless($lat >= -90 && $lat <= 90 && $lng >= -180 && $lng <= 180, 422, 'В заливке есть точка за пределами карты.');
                    $distance = HomeZoneService::distanceKm($zone['lat'], $zone['lng'], $lat, $lng);
                    abort_if($distance > $zone['radiusKm'], 422, 'Район должен целиком лежать в вашей зоне — часть заливки выходит за её край.');
                    $cleanRing[] = [$lng, $lat];
                    $pointCount++;
                    $sumLat += $lat;
                    $sumLng += $lng;
                }
                abort_if($pointCount > self::MAX_POINTS, 422, 'Слишком большая заливка: рисуйте компактный островок.');
                if (count($cleanRing) >= 4) {
                    $first = $cleanRing[0];
                    $last = $cleanRing[count($cleanRing) - 1];
                    if ($first !== $last) {
                        $cleanRing[] = $first;
                    }
                    $cleanRings[] = $cleanRing;
                }
            }
            if ($cleanRings !== []) {
                $cleanPolygons[] = $cleanRings;
            }
        }

        abort_if($cleanPolygons === [] || $pointCount === 0, 422, 'Пустая заливка: закрасьте кусочек карты кистью.');

        return [
            'geometry' => ['type' => 'MultiPolygon', 'coordinates' => $cleanPolygons],
            'center_lat' => $sumLat / $pointCount,
            'center_lng' => $sumLng / $pointCount,
        ];
    }

    /**
     * Лежит ли точка внутри района (лучевой алгоритм по внешнему кольцу).
     *
     * @param array $geometry GeoJSON MultiPolygon
     * @param float $lat широта точки
     * @param float $lng долгота точки
     * @return bool true когда точка внутри любого полигона
     */
    public static function containsPoint(array $geometry, float $lat, float $lng): bool
    {
        $polygons = $geometry['coordinates'] ?? [];
        if (!is_array($polygons)) {
            return false;
        }
        foreach ($polygons as $polygon) {
            $ring = $polygon[0] ?? [];
            if (self::ringContains($ring, $lat, $lng)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Живые пины внутри заливки района.
     *
     * @param District $district район
     * @param int $viewerId кто смотрит (для is_owner)
     * @return Collection<int,array> публичные карточки пинов
     */
    public static function pinsInside(District $district, int $viewerId): Collection
    {
        $geometry = is_array($district->geometry) ? $district->geometry : [];
        $centerLat = (float) $district->center_lat;
        $centerLng = (float) $district->center_lng;

        $candidates = Pin::active()
            ->whereBetween('latitude', [$centerLat - 0.5, $centerLat + 0.5])
            ->whereBetween('longitude', [$centerLng - 0.5, $centerLng + 0.5])
            ->with('user:id,name,avatar_path,level')
            ->limit(200)
            ->get();

        return $candidates
            ->filter(fn (Pin $pin) => self::containsPoint($geometry, (float) $pin->latitude, (float) $pin->longitude))
            ->values()
            ->map(fn (Pin $pin) => $pin->toPublicArray($viewerId));
    }

    /**
     * Сколько живых пинов внутри заливки (для карточки и слоя).
     *
     * @param District $district район
     * @return int число пинов
     */
    public static function pinsCount(District $district): int
    {
        return self::pinsInside($district, (int) $district->user_id)->count();
    }

    /**
     * @param array $ring кольцо [lng,lat]
     */
    private static function ringContains(array $ring, float $lat, float $lng): bool
    {
        $inside = false;
        $count = count($ring);
        if ($count < 4) {
            return false;
        }
        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            $xi = (float) ($ring[$i][0] ?? 0);
            $yi = (float) ($ring[$i][1] ?? 0);
            $xj = (float) ($ring[$j][0] ?? 0);
            $yj = (float) ($ring[$j][1] ?? 0);
            $crosses = (($yi > $lat) !== ($yj > $lat))
                && ($lng < ($xj - $xi) * ($lat - $yi) / (($yj - $yi) ?: 1e-12) + $xi);
            if ($crosses) {
                $inside = !$inside;
            }
        }

        return $inside;
    }
}
