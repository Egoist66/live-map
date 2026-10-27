import type { NominatimReverseResponse } from '@/types/entities/Geo'
import { kvGet, kvSet } from '@/db/app.db'

/**
 * Структурированный результат reverse-geocoding домашней точки.
 *
 * Нужен профилю и регистрации: из одной Nominatim-запроса собираем
 * и человекочитаемый адрес, и отдельные части — чтобы UI показывал
 * «город + улица (или район)», а хранилище получало аккуратные поля.
 */
export interface HomeReverse {
  /** Полная адресная строка без номера дома: улица/район + город, например «улица Ленина · Минск». */
  address: string
  /** Город (city / town / village / municipality) либо null. */
  city: string | null
  /** Район внутри города (suburb / city_district / neighbourhood / quarter) либо null. */
  district: string | null
  /** Улица (road), либо null — у малых населённых пунктов улицы нет. Номер дома не включается. */
  street: string | null
  /** Название страны либо null. */
  country: string | null
  /** ISO-код страны в нижнем регистре (например, 'by') либо null. */
  country_code: string | null
}

/** TTL кэша геокодинга: адреса меняются редко, Nominatim строг к лимитам (1 req/s). */
const GEO_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Дедуп параллельных запросов к Nominatim по одному ключу. */
const inflight = new Map<string, Promise<never>>()

/**
 * Ключ кэша: координаты округляем до ~100м — попадания выше, точность адреса та же.
 * @param lat широта
 * @param lng долгота
 * @param zoom зум Nominatim
 */
function revKey(lat: number, lng: number, zoom: number, suffix: string): string {
  return `geo:rev:${lat.toFixed(3)}:${lng.toFixed(3)}:${zoom}:${suffix}`
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await kvGet(key)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as { at: number; value: T }
    if (!parsed || Date.now() - Number(parsed.at) > GEO_TTL_MS) {
      return null
    }
    return parsed.value
  } catch {
    return null
  }
}

async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await kvSet(key, JSON.stringify({ at: Date.now(), value }))
  } catch {}
}

function deduped<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined
  if (existing) {
    return existing
  }
  const task = (async () => {
    try {
      return await loader()
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, task as Promise<never>)
  return task
}

export function formatAddr(d: NominatimReverseResponse): string {
  const a = d.address || ({} as any)
  const road = a.road || a.pedestrian || a.footway || a.street || a.path || a.cycleway || ''
  const house = a.house_number ? `, ${a.house_number}` : ''
  const city = a.city || a.town || a.village || a.municipality || a.county || ''
  const suburb = a.suburb || a.neighbourhood || a.quarter || ''
  if (road) return `${road}${house}${city ? ` · ${city}` : ''}`
  if (suburb && city) return `${suburb} · ${city}`
  return d.display_name?.split(',').slice(0, 3).join(', ') || 'Адрес не определён'
}

export async function reverseGeocode(lat: number, lng: number, zoom = 18): Promise<string> {
  const key = revKey(lat, lng, zoom, 'addr')
  const cached = await readCache<string>(key)
  if (cached !== null) {
    return cached
  }
  const value = await deduped(key, async () => {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&accept-language=ru`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) throw new Error('Geocode failed')
    const d = (await r.json()) as NominatimReverseResponse
    return formatAddr(d)
  })
  await writeCache(key, value)
  return value
}

export async function reverseGeocodeRaw(lat: number, lng: number, zoom = 14): Promise<{ address: string; raw: NominatimReverseResponse }> {
  const key = revKey(lat, lng, zoom, 'raw')
  const cached = await readCache<{ address: string; raw: NominatimReverseResponse }>(key)
  if (cached !== null) {
    return cached
  }
  const value = await deduped(key, async () => {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&accept-language=ru`)
    if (!r.ok) throw new Error('Geocode failed')
    const d = (await r.json()) as NominatimReverseResponse
    const a: any = d.address || {}
    const city = a.city || a.town || a.village || ''
    const road = a.road || a.suburb || ''
    const display = [road, city].filter(Boolean).join(' · ') || d.display_name?.split(',').slice(0, 2).join(', ') || `${lat}, ${lng}`
    return { address: display, raw: d }
  })
  await writeCache(key, value)
  return value
}

/**
 * Точный reverse-geocoding домашней точки: zoom 18 даёт улицу.
 *
 * Адрес хранится без номера дома — точность до улицы (или района,
 * если улицы в OSM нет) достаточна для дистанций свайпов, а точный
 * дом привлекает лишнее внимание. Отдельные части возвращаем
 * структурно, чтобы формы подставляли city/country, а адрес
 * сохраняли одной строкой.
 *
 * @param lat широта точки
 * @param lng долгота точки
 * @returns адрес вместе с разобранными частями
 */
export async function reverseGeocodeHome(lat: number, lng: number): Promise<HomeReverse> {
  const key = revKey(lat, lng, 18, 'home')
  const cached = await readCache<HomeReverse>(key)
  if (cached !== null) {
    return cached
  }
  const value = await deduped(key, async () => {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=ru`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) throw new Error('Geocode failed')
    const d = (await r.json()) as NominatimReverseResponse
    const a: any = d.address || {}

    const road = a.road || a.pedestrian || a.footway || a.street || a.path || a.cycleway || null
    // Номер дома не берём: точность «улица» достаточна для дистанций свайпов.
    const street = road ? String(road) : null
    const district = a.suburb || a.city_district || a.neighbourhood || a.quarter || null
    const city = a.city || a.town || a.village || a.municipality || null

    const displayParts = [street, district, city].filter((part): part is string => !!part)

    // fallback по display_name тоже без номера дома: он там идёт
    // отдельным сегментом и не должен попадать в профиль.
    const houseNumber = String(a.house_number ?? '').trim()
    const fallbackParts = String(d.display_name ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '' && part !== houseNumber)
      .slice(0, 3)

    const address = displayParts.join(' · ')
      || fallbackParts.join(', ')
      || `${lat}, ${lng}`

    return {
      address,
      city: city ? String(city) : null,
      district: district ? String(district) : null,
      street,
      country: a.country ? String(a.country) : null,
      country_code: a.country_code ? String(a.country_code).toLowerCase() : null,
    }
  })
  await writeCache(key, value)
  return value
}

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<{ country: string | null; country_code: string | null }> {
  const key = revKey(lat, lng, 3, 'country')
  const cached = await readCache<{ country: string | null; country_code: string | null }>(key)
  if (cached !== null) {
    return cached
  }
  const value = await deduped(key, async () => {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&accept-language=ru`)
    if (!r.ok) throw new Error('Geocode failed')
    const d = (await r.json()) as NominatimReverseResponse
    const a: any = d.address || {}
    const country = a.country ? String(a.country) : null
    const country_code = a.country_code ? String(a.country_code).toLowerCase() : null
    return { country, country_code }
  })
  await writeCache(key, value)
  return value
}

/**
 * Прямое геокодирование места (город/страна) в координаты.
 * Используется как стартовый центр карты, когда нет геопозиции.
 * @param query строка вида "Минск, Беларусь" или "Беларусь"
 * @returns координаты центра или null
 * @example
 * const c = await forwardGeocodePlace('Минск, Беларусь')
 */
export async function forwardGeocodePlace(query: string, timeoutMs = 6000): Promise<{ lat: number; lng: number } | null> {
  const q = query.trim()
  if (!q) return null
  const key = `geo:fwd:${q.toLowerCase()}`
  const cached = await readCache<{ lat: number; lng: number } | null>(key)
  if (cached !== null) {
    return cached
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&q=${encodeURIComponent(q)}`
  const value = await deduped(key, async () => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: ctrl.signal })
      if (!r.ok) return null
      const list = (await r.json()) as Array<{ lat: string; lon: string }>
      const first = list?.[0]
      if (!first) return null
      const lat = Number(first.lat)
      const lng = Number(first.lon)
      const valid = Number.isFinite(lat) && Number.isFinite(lng)
      return valid ? { lat, lng } : null
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  })
  await writeCache(key, value)
  return value
}
