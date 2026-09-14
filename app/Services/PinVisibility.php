<?php

namespace App\Services;

use App\Models\Pin;
use App\Models\PinInvite;
use App\Models\User;

/**
 * Единая проверка видимости пина: пол + страна + домашняя зона + приглашение.
 *
 * Правило: чужие пины видны только внутри своей зоны и своей страны.
 * Приглашение автора (`pin_invites`) снимает ограничения зоны/страны,
 * но не снимает пол, блокировки и статус.
 */
class PinVisibility
{
    /**
     * Ожидаемая страна зрителя (профиль → дом → live-гео).
     *
     * @return array{country: string|null, country_code: string|null}|null
     */
    public static function expectedCountry(User $viewer, ?float $liveLat = null, ?float $liveLng = null): ?array
    {
        try {
            return CountryResolver::expectedFor($viewer, $liveLat, $liveLng);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Страна пина (колонка → reverse-geocode с backfill).
     *
     * @return array{country: string|null, country_code: string|null}|null
     */
    public static function pinCountry(Pin $pin): ?array
    {
        $code = CountryResolver::normalizeCode($pin->country_code ?? null);
        $name = CountryResolver::normalizeName($pin->country ?? null);
        if ($code || $name) {
            return ['country' => $name, 'country_code' => $code];
        }
        try {
            $resolved = CountryResolver::fromCoords((float) $pin->latitude, (float) $pin->longitude);
        } catch (\Throwable) {
            return null;
        }
        if (!$resolved) {
            return null;
        }
        try {
            $pin->forceFill(['country' => $resolved['country'], 'country_code' => $resolved['country_code']])->saveQuietly();
        } catch (\Throwable) {
        }
        return $resolved;
    }

    public static function isInvited(Pin $pin, ?int $viewerId): bool
    {
        if (!$viewerId) {
            return false;
        }
        if ((int) $pin->user_id === $viewerId) {
            return true;
        }
        try {
            return PinInvite::where('pin_id', $pin->id)->where('invitee_id', $viewerId)->exists();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Полная проверка для чтения (index/show/realtime/подписки).
     *
     * Районный пин (district_id) виден только жителям района
     * (owner/member) плюс своей зоне: гость в зоне, но без
     * членства, не видит его до вступления.
     */
    public static function canView(?User $viewer, Pin $pin, ?float $liveLat = null, ?float $liveLng = null): bool
    {
        if ($viewer && $viewer->isAdmin()) {
            return true;
        }
        $viewerId = $viewer?->id;
        if ($viewerId && (int) $pin->user_id === (int) $viewerId) {
            return true;
        }
        $districtId = (int) ($pin->district_id ?? 0);
        if ($districtId > 0) {
            $isResident = DistrictService::isResident($districtId, $viewerId);
            if (!$isResident) {
                return false;
            }
        }
        if ($viewer && Pin::isSosCategory($pin->category ?? null) && $pin->status === 'active' && ! $pin->isExpired()) {
            return true;
        }
        if (!$pin->isVisibleForGender($viewer)) {
            return false;
        }
        if ($viewerId && self::isInvited($pin, $viewerId)) {
            return true;
        }
        if (!$viewer) {
            return false;
        }
        $expected = self::expectedCountry($viewer, $liveLat, $liveLng);
        $actual = self::pinCountry($pin);
        $expectedCode = $expected['country_code'] ?? null;
        $expectedName = $expected['country'] ?? null;
        $actualCode = $actual['country_code'] ?? null;
        $actualName = $actual['country'] ?? null;
        $bothKnown = ($expectedCode || $expectedName) && ($actualCode || $actualName);
        if ($bothKnown && !CountryResolver::sameCountry($expectedCode, $expectedName, $actualCode, $actualName)) {
            return false;
        }
        $zone = HomeZoneService::zoneFor($viewer, $liveLat, $liveLng);
        if ($zone === null) {
            return false;
        }
        $distance = HomeZoneService::distanceKm($zone['lat'], $zone['lng'], (float) $pin->latitude, (float) $pin->longitude);
        return $distance <= $zone['radiusKm'];
    }
}
