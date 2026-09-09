import { forwardGeocodePlace } from '@/services/geo.api'
import { RESIDENCE_COUNTRIES, normalizeCountryCode } from '@/composables/useResidence'

/** Координаты точки. */
export type MapCenter = { lat: number; lng: number }

/**
 * Мгновенные центры стран проживания — без сети.
 * Используются, когда прямой геокод недоступен (приватное окно,
 * блокировщик, обрыв сети): карта всё равно откроется на своей стране.
 */
const COUNTRY_CENTERS: Record<string, MapCenter & { zoom: number }> = {
  by: { lat: 53.9, lng: 27.56, zoom: 7 },
  ru: { lat: 55.75, lng: 37.61, zoom: 4 },
  ua: { lat: 50.45, lng: 30.52, zoom: 6 },
  pl: { lat: 52.23, lng: 21.01, zoom: 6 },
  lt: { lat: 54.68, lng: 25.27, zoom: 7 },
  lv: { lat: 56.94, lng: 24.1, zoom: 7 },
  ee: { lat: 59.43, lng: 24.75, zoom: 7 },
  kz: { lat: 51.16, lng: 71.42, zoom: 5 },
  de: { lat: 52.52, lng: 13.4, zoom: 6 },
  us: { lat: 39.8, lng: -98.5, zoom: 4 },
}

/**
 * Центр страны по коду или названию из профиля.
 * @param user текущий пользователь из Inertia-props
 * @returns центр и зум или null, если страна неизвестна
 */
function staticCountryCenter(user: any): (MapCenter & { zoom: number }) | null {
  const code = normalizeCountryCode(user?.country_code)
  if (code && COUNTRY_CENTERS[code]) return COUNTRY_CENTERS[code]
  const name = String(user?.country || '').trim().toLowerCase()
  if (!name) return null
  const found = RESIDENCE_COUNTRIES.find((x) => x.name.toLowerCase() === name)
  if (!found) return null
  return COUNTRY_CENTERS[found.code] || null
}

/** Сохранённая точка из localStorage. */
function readCachedPos(): MapCenter | null {
  try {
    const raw = localStorage.getItem('live-map:last-pos')
    if (!raw) return null
    const p = JSON.parse(raw)
    const lat = Number(p?.lat)
    const lng = Number(p?.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    if (lat === 0 && lng === 0) return null
    return { lat, lng }
  } catch {
    return null
  }
}

/** Домашние координаты из профиля (заданы кнопкой на регистрации). */
function homeOf(user: any): MapCenter | null {
  const lat = Number(user?.home_lat)
  const lng = Number(user?.home_lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat === 0 && lng === 0) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Стартовый центр карты без запроса геопозиции.
 *
 * Приоритет: кэш браузера → дом из профиля → город по сети →
 * статичный центр страны → страна по сети → мир.
 * Геолокацию браузера здесь не запрашиваем: если пользователь пропустил
 * точку при регистрации, карту открываем по стране/городу, а точную
 * точку он покажет сам кнопкой геолокации (GeolocateControl).
 * @param user текущий пользователь из Inertia-props
 * @returns центр, признак точной точки, стартовый зум и источник
 * @example
 * const { center, zoom, source } = await resolveInitialCenter(page.props.auth?.user)
 */
export type MapCenterSource = 'cached' | 'home' | 'residence' | 'none'

export async function resolveInitialCenter(
  user: any,
): Promise<{ center: MapCenter | null; hasPrecise: boolean; zoom: number; source: MapCenterSource }> {
  const cached = readCachedPos()
  if (cached) return { center: cached, hasPrecise: false, zoom: 13, source: 'cached' }

  const home = homeOf(user)
  if (home) return { center: home, hasPrecise: true, zoom: 13, source: 'home' }

  const city = String(user?.home_city || '').trim()
  const country = String(user?.country || '').trim()

  if (city && country) {
    const geo = await forwardGeocodePlace(`${city}, ${country}`)
    if (geo) return { center: geo, hasPrecise: false, zoom: 11, source: 'residence' }
  }

  if (city) {
    const geo = await forwardGeocodePlace(city)
    if (geo) return { center: geo, hasPrecise: false, zoom: 11, source: 'residence' }
  }

  const fallback = staticCountryCenter(user)
  if (fallback) {
    const center: MapCenter = { lat: fallback.lat, lng: fallback.lng }
    return { center, hasPrecise: false, zoom: fallback.zoom, source: 'residence' }
  }

  if (country) {
    const geo = await forwardGeocodePlace(country)
    if (geo) return { center: geo, hasPrecise: false, zoom: 6, source: 'residence' }
  }

  return { center: null, hasPrecise: false, zoom: 2, source: 'none' }
}

/**
 * Домашняя точка пользователя для якоря зоны до первой геолокации.
 * @param user текущий пользователь из Inertia-props
 * @returns координаты дома или null
 */
export function homeAnchorOf(user: any): MapCenter | null {
  return homeOf(user)
}

/**
 * Максимальная погрешность живого фикса, которому доверяем кэш и автополёт.
 * Грубее 100 км — обычно IP-позиция под VPN (не тот континент):
 * точку рисуем, но в кэш не пишем и карту туда не уводим.
 */
export const MAX_GEO_ACCURACY_M = 100000

/**
 * Проверяет, достаточно ли точный фикс для кэша и автополёта.
 * @param accuracy погрешность в метрах или null/undefined
 * @returns true если точность известна и не хуже лимита
 */
export function isSaneFix(accuracy: number | null | undefined): boolean {
  return typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy <= MAX_GEO_ACCURACY_M
}
