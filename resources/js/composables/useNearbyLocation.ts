import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useGeolocation } from '@/composables/useGeolocation'
import { reverseGeocodeHome } from '@/services/geo.api'
import { datingApi } from '@/services/dating.api'
import type { SwipeLocation } from '@/services/dating.api'

/**
 * Автоопределение локации для фильтра «Люди рядом».
 *
 * Когда человек включает близость, но точки в профиле ещё нет, просим
 * у браузера позицию, разбираем её до страны/города/района/улицы
 * (без номера дома) и сохраняем в профиль. После этого дистанции
 * считаются у обеих сторон, а человека видят в радиусе рядом с ним.
 *
 * @returns состояние определения и метод locateAndSave
 * @example
 * const nearby = useNearbyLocation()
 * const saved = await nearby.locateAndSave()
 */
export function useNearbyLocation() {
  const geolocation = useGeolocation()
  const locating = ref(false)
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /**
   * Показать уведомление, если Toast смонтирован.
   *
   * @param options параметры тоста PrimeVue
   * @returns void
   */
  function notify(options: {
    severity: 'success' | 'warn' | 'error'
    summary: string
    detail: string
  }): void {
    toast?.add({ ...options, life: 4500 })
  }

  /**
   * Определить позицию, собрать безопасный адрес и сохранить локацию.
   *
   * При отказе в доступе возвращает null и показывает причину —
   * фильтр «рядом» в этом случае нужно снять, иначе он бесполезен.
   *
   * @returns сохранённая локация либо null при отказе/ошибке
   */
  async function locateAndSave(): Promise<SwipeLocation | null> {
    if (locating.value) {
      return null
    }

    locating.value = true

    try {
      const position = await geolocation.requestGeolocation()

      if (!position) {
        const reason = geolocation.error.value || 'Не удалось определить позицию'

        notify({
          severity: 'warn',
          summary: 'Без геопозиции',
          detail: `${reason} — «Люди рядом» выключено, можно указать город в профиле`,
        })

        return null
      }

      const lat = Number(position.lat.toFixed(7))
      const lng = Number(position.lng.toFixed(7))

      let city: string | null = null
      let address: string | null = null
      let country: string | null = null
      let countryCode: string | null = null
      let addressDetail = ''

      try {
        const place = await reverseGeocodeHome(lat, lng)

        city = place.city
        address = place.address
        country = place.country
        countryCode = place.country_code

        addressDetail = joinPlaceParts(place.country, place.city, place.district, place.street)
      } catch {
        // Координат достаточно для дистанций: адрес дозаполнится
        // при следующем определении из профиля.
      }

      const saved = await datingApi.updateLocation({
        lat,
        lng,
        city,
        address,
        country,
        country_code: countryCode,
      })

      notify({
        severity: 'success',
        summary: 'Локация определена',
        detail: addressDetail
          ? `Ищем рядом: ${addressDetail}`
          : 'Расстояния теперь считаются по твоей точке — точный дом не показывается',
      })

      return saved
    } catch (e: unknown) {
      const error = e as { response?: { data?: { message?: string } } }

      notify({
        severity: 'error',
        summary: 'Не удалось сохранить локацию',
        detail: error.response?.data?.message ?? 'Попробуй ещё раз или укажи город в профиле',
      })

      return null
    } finally {
      locating.value = false
    }
  }

  /**
   * Собрать читаемую строку «страна · город · район · улица».
   *
   * Пустые части пропускаются, дубли (например, район = город)
   * не повторяются — подпись остаётся короткой.
   *
   * @param parts части адреса в порядке от страны до улицы
   * @returns строка для тоста либо пустая строка
   */
  function joinPlaceParts(...parts: Array<string | null | undefined>): string {
    const unique: string[] = []

    for (const part of parts) {
      const value = String(part ?? '').trim()

      if (value === '') {
        continue
      }

      if (!unique.includes(value)) {
        unique.push(value)
      }
    }

    return unique.join(' · ')
  }

  return { locating, error: geolocation.error, locateAndSave }
}
