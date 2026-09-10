import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { haversineKm } from '@/utils/geo'
import { maxHomeRadiusKm, planOf } from './usePlanLimits'

/**
 * Guard домашней зоны: создание и просмотр чужих пинов только внутри радиуса.
 * Центр — живая геопозиция, если гео включено, иначе статичный дом из профиля.
 * Админ — без ограничений. Без центра зоны (нет дома и гео) — запрет.
 * @example const guard = useHomeZoneGuard(); guard.assertCanCreate(lat, lng, livePos)
 */
export function useHomeZoneGuard() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any)?.user)

  const isAdmin = computed(() => !!user.value?.is_admin || user.value?.role === 'admin')

  const zoneRadiusKm = computed(() => {
    const u = user.value
    if (!u) return 10
    const wanted = Number(u.home_radius_km ?? 10) || 10
    return Math.min(Math.max(1, wanted), maxHomeRadiusKm(planOf(u), isAdmin.value))
  })

  /**
   * @param livePos живая геопозиция (null — гео выключено, берём дом)
   */
  function zoneCenter(livePos?: { lat: number; lng: number } | null): { lat: number; lng: number; live: boolean } | null {
    if (livePos && Number.isFinite(livePos.lat) && Number.isFinite(livePos.lng)) {
      return { lat: livePos.lat, lng: livePos.lng, live: true }
    }
    const u = user.value
    const lat = u?.home_lat != null ? Number(u.home_lat) : NaN
    const lng = u?.home_lng != null ? Number(u.home_lng) : NaN
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng, live: false }
  }

  /**
   * @param pinLat широта точки операции
   * @param pinLng долгота точки операции
   * @param livePos живая геопозиция или null
   */
  function check(pinLat: number, pinLng: number, livePos?: { lat: number; lng: number } | null): { ok: boolean; message?: string; distanceKm?: number } {
    if (isAdmin.value) return { ok: true }
    const center = zoneCenter(livePos ?? null)
    if (!center) {
      return {
        ok: false,
        message: 'Операция запрещена — у вас не задан дом: создание пинов доступно только внутри вашей зоны. Укажите дом в профиле.',
      }
    }
    const distance = haversineKm(center.lat, center.lng, pinLat, pinLng)
    if (distance <= zoneRadiusKm.value) return { ok: true, distanceKm: distance }
    const where = center.live ? 'вашей текущей геопозиции' : 'вашего дома'
    const dist = distance.toFixed(1).replace('.', ',')
    return {
      ok: false,
      distanceKm: distance,
      message: `Операция запрещена — точка вне вашей зоны (${dist} км от ${where}, радиус ${zoneRadiusKm.value} км). Free — до 10 км, больше — тариф Pro.`,
    }
  }

  return { user, isAdmin, zoneRadiusKm, zoneCenter, check }
}
