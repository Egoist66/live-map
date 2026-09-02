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
