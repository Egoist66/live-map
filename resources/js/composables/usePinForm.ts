import { ref } from 'vue'
import { route } from '@/route'
import { usePins } from './usePins'
import { useHomeZoneGuard } from './useHomeZoneGuard'
import type { CreatePinPayload, PinCategory } from '@/types/entities/Pin'

/**
 * Упрощённая форма пина: создание только внутри своей зоны.
 * @param onCreated колбэк после создания
 */
export function usePinForm(onCreated?: () => void) {
  const { createPin } = usePins()
  const zoneGuard = useHomeZoneGuard()
  const newPin = ref<CreatePinPayload>({
    title: '',
    body: '',
    category: 'announcement' as PinCategory,
    latitude: 0,
    longitude: 0,
    location_precision: 'blur_200' as 'blur_200' | 'exact' | 'district' | 'custom',
    blur_meters: 200,
    is_anonymous: false,
    radius_meters: 1000,
  })

  function setCoords(lat: number, lng: number) {
    newPin.value.latitude = Number(lat.toFixed(7))
    newPin.value.longitude = Number(lng.toFixed(7))
  }

  async function submit(isAuth: boolean): Promise<void> {
    if (!isAuth) { const { router } = await import('@inertiajs/vue3'); router.visit(route('login')); return }
    const livePos = readLivePos()
    const zone = zoneGuard.check(Number(newPin.value.latitude), Number(newPin.value.longitude), livePos)
    if (!zone.ok) throw new Error(zone.message || 'Точка вне вашей зоны')
    await createPin(newPin.value)
    newPin.value.title = ''
    newPin.value.body = ''
    onCreated?.()
  }

  /**
   * Последняя известная геопозиция из кэша карты.
   * @returns координаты или null
   */
  function readLivePos(): { lat: number; lng: number } | null {
    try {
      const raw = localStorage.getItem('live-map:last-pos')
      const parsed = raw ? JSON.parse(raw) : null
      const lat = Number(parsed?.lat)
      const lng = Number(parsed?.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return { lat, lng }
    } catch {
      return null
    }
  }

  return { newPin, setCoords, submit }
}
