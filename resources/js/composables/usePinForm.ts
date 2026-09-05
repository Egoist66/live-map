import { ref } from 'vue'
import { usePins } from './usePins'
import type { CreatePinPayload, PinCategory } from '@/types/entities/Pin'

export function usePinForm(onCreated?: () => void) {
  const { createPin } = usePins()
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
    await createPin(newPin.value)
    newPin.value.title = ''
    newPin.value.body = ''
    onCreated?.()
  }

  return { newPin, setCoords, submit }
}
