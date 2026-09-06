import { ref, watch } from 'vue'
import { reverseGeocodeCountry } from '@/services/geo.api'
import { normalizeCountryCode, sameCountry } from '@/composables/useResidence'

export type ResidenceSource = {
  country: string | null | undefined
  country_code: string | null | undefined
  lat: number | string | null | undefined
  lng: number | string | null | undefined
}

export function residenceMismatchMessage(declared: string, detected: string): string {
  return `Страна «${declared}» не совпадает с геолокацией (${detected}). Сохранение запрещено — укажите страну, где вы находитесь.`
}

const detectedCache = new Map<string, { country: string | null; country_code: string | null }>()

export function useCountryMismatch(source: () => ResidenceSource) {
  const checking = ref(false)
  const warning = ref<string | null>(null)
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  function coordsOf(s: ResidenceSource): { lat: number; lng: number } | null {
    const lat = Number(s.lat)
    const lng = Number(s.lng)
    if (s.lat == null || s.lat === '' || s.lng == null || s.lng === '') return null
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
    return { lat, lng }
  }

  async function recheck(): Promise<boolean> {
    const s = source()
    const declared = (s.country || '').trim() || (s.country_code || '').trim()
    const coords = coordsOf(s)
    if (!declared || !coords) {
      warning.value = null
      return true
    }
    const key = `${coords.lat.toFixed(2)}:${coords.lng.toFixed(2)}`
    checking.value = true
    const my = ++seq
    try {
      let det = detectedCache.get(key)
      if (!det) {
        det = await reverseGeocodeCountry(coords.lat, coords.lng)
        detectedCache.set(key, det)
      }
      if (my !== seq) return warning.value === null
      if (!det.country && !det.country_code) {
        warning.value = null
        return true
      }
      if (sameCountry(normalizeCountryCode(s.country_code), s.country, det.country_code, det.country)) {
        warning.value = null
        return true
      }
      warning.value = residenceMismatchMessage(declared, det.country || det.country_code || 'другая страна')
      return false
    } catch {
      if (my === seq) warning.value = null
      return true
    } finally {
      if (my === seq) checking.value = false
    }
  }

  function schedule() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void recheck() }, 500)
  }

  watch(() => {
    const s = source()
    return [s.country, s.country_code, s.lat, s.lng]
  }, schedule)

  return { countryWarning: warning, checkingCountry: checking, recheckCountry: recheck }
}
