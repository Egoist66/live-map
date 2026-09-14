import { usePage } from '@inertiajs/vue3'
import { useDistrictsStore } from '@/stores/districts'

function toRad(v: number): number {
  return (v * Math.PI) / 180
}

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const earth = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return earth * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

function authUser(): any {
  try {
    return (usePage().props.auth as any)?.user ?? null
  } catch {
    return null
  }
}

/**
 * Житель ли текущий пользователь района (по слою карты).
 *
 * Район вне стора считаем доступным: бэк уже отфильтровал,
 * раз пин долетел — пользователь житель.
 *
 * @param districtId id района пина
 * @returns true если можно показать районный пин
 */
function isDistrictResident(districtId: number): boolean {
  try {
    const store = useDistrictsStore?.()
    const list = (store as any)?.districts ?? []
    const found = (Array.isArray(list) ? list : []).find((d: any) => Number(d?.id) === Number(districtId))
    if (!found) {
      return true
    }
    const role = String(found.role ?? 'guest')

    return role === 'owner' || role === 'member'
  } catch {
    return true
  }
}

/**
 * Клиентская проверка видимости пина: район + страна + зона.
 * Дублирует бэкенд PinVisibility, чтобы realtime из общей
 * Map-рассылки не показывал чужие страны (Польша → Минск).
 * Районный пин виден только жителям района: гость в зоне,
 * но без членства, не видит его до вступления.
 * Активный SOS виден всем, как на бэкенде, кроме районных.
 *
 * @param pin пин из realtime или API
 * @param livePos живая геопозиция, если гео включено
 * @returns true если пин можно показать
 */
export function isPinVisibleLocally(pin: any, livePos?: { lat: number; lng: number } | null): boolean {
  try {
    const user = authUser()
    if (!user) {
      return false
    }
    if (user.is_admin || user.role === 'admin') {
      return true
    }
    if (pin?.is_owner || Number(pin?.user_id) === Number(user.id)) {
      return true
    }
    const districtId = Number(pin?.district_id ?? 0)
    if (districtId > 0 && !isDistrictResident(districtId)) {
      return false
    }
    if (String(pin?.category ?? '').toLowerCase() === 'sos' && String(pin?.status ?? 'active') === 'active') {
      return true
    }
    const audience = String(pin?.gender_audience || 'all')
    if (audience === 'male' || audience === 'female') {
      if (user.gender !== audience) {
        return false
      }
    }
    const pinCode = pin?.country_code ? String(pin.country_code).toLowerCase() : null
    const userCode = user.country_code ? String(user.country_code).toLowerCase() : null
    if (pinCode && userCode && pinCode !== userCode) {
      return false
    }
    const homeLat = user.home_lat != null ? Number(user.home_lat) : null
    const homeLng = user.home_lng != null ? Number(user.home_lng) : null
    const center = livePos || (homeLat != null && homeLng != null ? { lat: homeLat, lng: homeLng } : null)
    if (!center) {
      return false
    }
    const radius = Number(user.home_radius_km ?? 10) || 10
    const pinLat = Number(pin?.latitude ?? pin?.lat)
    const pinLng = Number(pin?.longitude ?? pin?.lng)
    if (!Number.isFinite(pinLat) || !Number.isFinite(pinLng)) {
      return false
    }
    return distanceKm(center.lat, center.lng, pinLat, pinLng) <= radius
  } catch {
    return false
  }
}
