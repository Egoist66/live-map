import { ref, computed } from 'vue'
import { reverseGeocode } from '@/services/geo.api'

export type HomeVisibility = 'everyone' | 'friends' | 'none'

export const HOME_VISIBILITY_OPTIONS: { value: HomeVisibility; label: string; icon: string }[] = [
  { value: 'everyone', label: 'Всем', icon: 'pi pi-globe' },
  { value: 'friends', label: 'Друзьям', icon: 'pi pi-users' },
  { value: 'none', label: 'Скрыто', icon: 'pi pi-lock' },
]

export function canShowExactHome(plan?: string | null, isAdmin?: boolean): boolean {
  if (isAdmin) return true
  return plan === 'pro' || plan === 'business'
}

export function effectiveHomeBlurMeters(plan: string | null | undefined, showExact: boolean, defaultBlur: number, isAdmin = false): number {
  if (showExact && canShowExactHome(plan, isAdmin)) return 0
  return Math.max(300, Number(defaultBlur || 300))
}

export function useHomeLocation(opts: {
  getPlan: () => string
  isAdmin: () => boolean
  getBlur: () => number
  setCoords: (lat: number, lng: number, address: string) => void
}) {
  const locating = ref(false)
  const geoError = ref<string | null>(null)

  const canExact = computed(() => canShowExactHome(opts.getPlan(), opts.isAdmin()))

  async function locate() {
    geoError.value = null
    if (!navigator.geolocation) {
      geoError.value = 'Геолокация недоступна'
      return
    }
    locating.value = true
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }),
      )
      const lat = Number(pos.coords.latitude.toFixed(7))
      const lng = Number(pos.coords.longitude.toFixed(7))
      let address = ''
      try {
        address = await reverseGeocode(lat, lng)
      } catch {
        address = ''
      }
      opts.setCoords(lat, lng, address)
    } catch {
      geoError.value = 'Не удалось получить геопозицию'
    } finally {
      locating.value = false
    }
  }

  return { locating, geoError, canExact, locate, options: HOME_VISIBILITY_OPTIONS }
}
