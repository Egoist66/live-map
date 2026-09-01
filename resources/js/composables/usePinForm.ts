import { ref } from 'vue'
import { usePins } from './usePins'

export function usePinForm(onCreated?: () => void) {
  const { createPin } = usePins()
  const newPin = ref({
    title: '',
    body: '',
    category: 'announcement' as string,
    latitude: 53.9022,
    longitude: 27.5615,
    location_precision: 'blur_200' as 'blur_200' | 'exact' | 'district',
    is_anonymous: false,
  })

  function setCoords(lat: number, lng: number) {
    newPin.value.latitude = Number(lat.toFixed(7))
    newPin.value.longitude = Number(lng.toFixed(7))
  }

  async function submit(isAuth: boolean) {
    if (!isAuth) { window.location.href = '/login'; return }
    await createPin(newPin.value)
    newPin.value.title = ''
    newPin.value.body = ''
    onCreated?.()
  }

  return { newPin, setCoords, submit }
}
