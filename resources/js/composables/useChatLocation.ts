import { ref } from 'vue'
import { useGeolocation } from '@/composables/useGeolocation'

/**
 * Геопозиция в чате: построение текстового сообщения с координатами и ссылками.
 *
 * Сообщение — обычный текст, ссылки на Яндекс/Гугл карты подхватывает
 * linkify в `renderWithMentions`.
 *
 * @example
 * const { locating, locationError, shareLocation } = useChatLocation()
 * await shareLocation((text) => chat.sendMessage(text))
 */

export const LOCATION_HEADER = '📍 Моя геопозиция'

/**
 * Строка координат с фиксированной точностью.
 *
 * @param lat широта
 * @param lng долгота
 * @returns строка вида "55.755800, 37.617300"
 */
export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/**
 * Ссылка на точку в Яндекс Картах.
 *
 * @param lat широта
 * @param lng долгота
 * @returns url
 */
export function yandexMapsUrl(lat: number, lng: number): string {
  return `https://yandex.ru/maps/?pt=${lng.toFixed(6)},${lat.toFixed(6)},pm2rdm&z=16`
}

/**
 * Ссылка на точку в Google Maps.
 *
 * @param lat широта
 * @param lng долгота
 * @returns url
 */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}&z=16`
}

/**
 * Текст сообщения с геопозицией.
 *
 * @param lat широта
 * @param lng долгота
 * @returns готовый текст сообщения
 */
export function buildLocationMessage(lat: number, lng: number): string {
  const coords = formatCoords(lat, lng)
  const yandex = yandexMapsUrl(lat, lng)
  const google = googleMapsUrl(lat, lng)

  return `${LOCATION_HEADER}\n${coords}\nЯндекс Карты: ${yandex}\nGoogle Maps: ${google}`
}

export function useChatLocation() {
  const geo = useGeolocation()
  const locating = ref(false)
  const locationError = ref<string | null>(null)

  /**
   * Запросить геопозицию и отправить сообщение через колбэк.
   *
   * @param send отправка текста сообщения
   * @returns true если отправлено
   */
  async function shareLocation(send: (text: string) => Promise<unknown>): Promise<boolean> {
    if (locating.value) {
      return false
    }

    locating.value = true
    locationError.value = null

    try {
      const pos = await geo.requestGeolocation()

      if (!pos) {
        locationError.value = geo.error.value || 'Не удалось определить позицию'
        return false
      }

      const text = buildLocationMessage(pos.lat, pos.lng)
      await send(text)

      return true
    } catch {
      locationError.value = 'Не удалось отправить геопозицию'
      return false
    } finally {
      locating.value = false
    }
  }

  return { locating, locationError, shareLocation }
}
