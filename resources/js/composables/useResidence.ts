import { computed, ref } from 'vue'
import { reverseGeocodeCountry, reverseGeocodeRaw } from '@/services/geo.api'

export const RESIDENCE_COUNTRIES = [
  { name: 'Беларусь', code: 'by' },
  { name: 'Россия', code: 'ru' },
  { name: 'Украина', code: 'ua' },
  { name: 'Польша', code: 'pl' },
  { name: 'Литва', code: 'lt' },
  { name: 'Латвия', code: 'lv' },
  { name: 'Эстония', code: 'ee' },
  { name: 'Казахстан', code: 'kz' },
  { name: 'Германия', code: 'de' },
  { name: 'США', code: 'us' },
] as const

export function normalizeCountryCode(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim().toLowerCase()
  return s === '' ? null : s
}

export function countryNameByCode(code: string | null | undefined): string | null {
  if (!code) return null
  const c = String(code).toLowerCase()
  return RESIDENCE_COUNTRIES.find((x) => x.code === c)?.name ?? null
}

export function sameCountry(aCode?: string | null, aName?: string | null, bCode?: string | null, bName?: string | null): boolean {
  const a = normalizeCountryCode(aCode)
  const b = normalizeCountryCode(bCode)
  if (a && b) return a === b
  if (aName && bName) return aName.trim().toLowerCase() === bName.trim().toLowerCase()
  return false
}

export function countryGuardMessage(home: string, there: string): string {
  return `Операция запрещена — карта ограничена страной проживания (${home}). Пин находится в: ${there}.`
}

export function useResidence(getUser: () => any) {
  const resolving = ref(false)
  const userCountry = computed(() => getUser()?.country ?? null)
  const userCountryCode = computed(() => normalizeCountryCode(getUser()?.country_code))
  const residenceLabel = computed(() => {
    const u = getUser()
    if (!u) return ''
    const parts = [u.country, u.home_city].filter(Boolean)
    return parts.join(' · ')
  })

  async function detectResidence(lat: number, lng: number): Promise<{ country: string | null; country_code: string | null; city: string | null; address: string }> {
    resolving.value = true
    try {
      const [c, full] = await Promise.all([reverseGeocodeCountry(lat, lng).catch(() => ({ country: null, country_code: null })), reverseGeocodeRaw(lat, lng, 14).catch(() => null)])
      const a: any = (full?.raw as any)?.address || {}
      const city = a.city || a.town || a.village || a.municipality || a.county || null
      return { country: c.country, country_code: c.country_code, city, address: full?.address || '' }
    } finally {
      resolving.value = false
    }
  }

  async function assertPinInHomeCountry(pinLat: number, pinLng: number): Promise<{ ok: boolean; message?: string }> {
    const u = getUser()
    if (!u || u.is_admin || u.role === 'admin') return { ok: true }
    let expectedCode = normalizeCountryCode(u.country_code)
    let expectedName: string | null = u.country ?? null
    if (!expectedCode && !expectedName) {
      const homeLat = u.home_lat != null ? Number(u.home_lat) : null
      const homeLng = u.home_lng != null ? Number(u.home_lng) : null
      if (homeLat != null && homeLng != null && Number.isFinite(homeLat) && Number.isFinite(homeLng)) {
        try {
          const c = await reverseGeocodeCountry(homeLat, homeLng)
          expectedCode = c.country_code
          expectedName = c.country
        } catch { /* ignore - backend recheck */ }
      }
      if (!expectedCode && !expectedName) return { ok: true }
    }
    let pin: { country: string | null; country_code: string | null } | null = null
    try {
      pin = await reverseGeocodeCountry(pinLat, pinLng)
    } catch { return { ok: true } }
    if (!pin || (!pin.country && !pin.country_code)) return { ok: true }
    if (sameCountry(expectedCode, expectedName, pin.country_code, pin.country)) return { ok: true }
    return { ok: false, message: countryGuardMessage(expectedName || expectedCode || 'страна проживания', pin.country || pin.country_code || 'другая страна') }
  }

  return { resolving, userCountry, userCountryCode, residenceLabel, detectResidence, assertPinInHomeCountry, sameCountry, countryGuardMessage }
}
