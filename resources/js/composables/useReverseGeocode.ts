import { ref } from 'vue'
import { reverseGeocode } from '@/services/geo.api'
import { haversineKm } from '@/utils/geo'

const MIN_DISTANCE_KM = 0.05
const MIN_INTERVAL_MS = 30000

/**
 * Реверсивный геокод с защитой от спама Nominatim.
 * Пропускает повторные запросы рядом и чаще MIN_INTERVAL_MS,
 * не трогает loading при пропуске чтобы не мигал блок "Вы здесь".
 * @returns адрес, флаг загрузки и fetch с троттлингом
 */
export function useReverseGeocode() {
  const address = ref('')
  const loading = ref(false)
  const lastCoords = ref<{ lat: number; lng: number } | null>(null)
  const lastFetchedAt = ref(0)
  const inFlight = ref(false)

  async function fetch(lat: number, lng: number) {
    const now = Date.now()
    const prev = lastCoords.value
    const timeSinceFetch = now - lastFetchedAt.value
    if (prev) {
      const distKm = haversineKm(prev.lat, prev.lng, lat, lng)
      const isNear = distKm < MIN_DISTANCE_KM
      const isSoon = timeSinceFetch < MIN_INTERVAL_MS
      if ((isNear && isSoon) || inFlight.value) {
        return address.value
      }
    }
    if (inFlight.value) {
      return address.value
    }
    inFlight.value = true
    loading.value = true
    try {
      const next = await reverseGeocode(lat, lng)
      address.value = next
      lastCoords.value = { lat, lng }
      lastFetchedAt.value = Date.now()
    } catch {
      address.value = ''
    } finally {
      inFlight.value = false
      loading.value = false
    }
    return address.value
  }

  return { address, loading, fetch, fetchAddress: fetch }
}

export function useMyStreet() {
  const street = ref('')
  const loading = ref(false)
  async function fetch(lat: number, lng: number) {
    loading.value = true
    try {
      street.value = await reverseGeocode(lat, lng)
    } catch {
      street.value = ''
    } finally {
      loading.value = false
    }
    return street.value
  }
  return { street, loading, fetch }
}
