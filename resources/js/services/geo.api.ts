import type { NominatimReverseResponse } from '@/types/entities/Geo'

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
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&accept-language=ru`, {
    headers: { Accept: 'application/json' },
  })
  if (!r.ok) throw new Error('Geocode failed')
  const d = (await r.json()) as NominatimReverseResponse
  return formatAddr(d)
}

export async function reverseGeocodeRaw(lat: number, lng: number, zoom = 14): Promise<{ address: string; raw: NominatimReverseResponse }> {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&accept-language=ru`)
  if (!r.ok) throw new Error('Geocode failed')
  const d = (await r.json()) as NominatimReverseResponse
  const a: any = d.address || {}
  const city = a.city || a.town || a.village || ''
  const road = a.road || a.suburb || ''
  const display = [road, city].filter(Boolean).join(' · ') || d.display_name?.split(',').slice(0, 2).join(', ') || `${lat}, ${lng}`
  return { address: display, raw: d }
}

export async function reverseGeocodeCountry(lat: number, lng: number): Promise<{ country: string | null; country_code: string | null }> {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&accept-language=ru`)
  if (!r.ok) throw new Error('Geocode failed')
  const d = (await r.json()) as NominatimReverseResponse
  const a: any = d.address || {}
  const country = a.country ? String(a.country) : null
  const country_code = a.country_code ? String(a.country_code).toLowerCase() : null
  return { country, country_code }
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
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ru&q=${encodeURIComponent(q)}`
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
}
