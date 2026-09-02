import { ref } from 'vue'
import { reverseGeocode } from '@/services/geo.api'

export function useReverseGeocode() {
  const address = ref('')
  const loading = ref(false)

  async function fetch(lat: number, lng: number) {
    loading.value = true
    try {
      address.value = await reverseGeocode(lat, lng)
    } catch {
      address.value = ''
    } finally {
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
