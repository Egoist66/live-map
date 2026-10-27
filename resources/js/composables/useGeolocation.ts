import { ref } from 'vue'

const LAST_POS_KEY = 'live-map:last-pos'

function readLastPos(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(LAST_POS_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (Number.isFinite(p?.lat) && Number.isFinite(p?.lng) && (p.lat !== 0 || p.lng !== 0)) return p
  } catch {}
  return null
}

/**
 * Понятная причина отказа по коду GeolocationPositionError.
 *
 * Код 1 (PERMISSION_DENIED) — site-level запрет домена в браузере,
 * даже если в системе геолокация включена: Chrome после клика
 * «Блокировать» больше не показывает prompt, юзер должен перевернуть
 * разрешение в значке слева от адреса. Отдельно ловим незащищённый
 * origin — там geolocation запрещён API всегда.
 *
 * @param err ошибка браузерного geolocation API
 * @returns текст для тоста/карточки
 */
function describeError(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Геолокация работает только по https или localhost — сейчас открыт незащищённый адрес'
  }

  const code = (err as GeolocationPositionError | null | undefined)?.code

  if (code === 1) {
    return 'Браузер запретил доступ к местоположению для сайта. Нажми значок замка слева от адреса → «Разрешить геопозицию» и обнови страницу'
  }

  if (code === 2) return 'Позиция недоступна — не слышна сеть и GPS'
  if (code === 3) return 'Ожидание позиции истекло'

  return `Не удалось определить позицию (код ${(err as { code?: number } | null | undefined)?.code ?? 0})`
}

/** Диагностика в консоль: видно код, сообщение и origin из DevTools. */
function logGeolocationFailure(err: unknown): void {
  if (typeof console === 'undefined') return

  console.warn('[geolocation] отказ', {
    code: (err as GeolocationPositionError | null | undefined)?.code ?? 0,
    message: (err as { message?: string } | null | undefined)?.message ?? 'без сообщения',
    origin: typeof window !== 'undefined' ? window.location.origin : null,
    secureContext: typeof window !== 'undefined' ? window.isSecureContext : null,
  })

  // Состояние разрешения сайта в момент отказа: расхождение state
  // ('granted') с фактическим кодом 1 — признак enterprise-политики
  // либо неаккуратного переключения настроек Chrome.
  void navigator.permissions
    ?.query({ name: 'geolocation' as PermissionName })
    .then((status) => console.warn('[geolocation] permission.state =', status.state))
    .catch(() => {})
}

/**
 * Состояние разрешения сайта, если Permissions API недоступен — null.
 *
 * @returns 'granted' | 'denied' | 'prompt' | null
 */
function permissionState(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions) {
    return Promise.resolve(null)
  }

  return navigator.permissions
    .query({ name: 'geolocation' as PermissionName })
    .then((status) => status.state)
    .catch(() => null)
}

/**
 * Запрос геопозиции с каскадом попыток.
 *
 * Точный GPS-приёмник часто молчит под крышей или в квартире: тогда
 * первая попытка (enableHighAccuracy) упирается в таймаут или код 2
 * (POSITION_UNAVAILABLE), хотя разрешение браузером выдано. Поэтому:
 * 1) точный запрос — 2) ретрай при «глюке первого отказа» после
 * выдачи разрешения — 3) грубая сеть/Wi-Fi позиция — 4) кэш последней
 * удачной фиксации. Настоящий site-level запрет (код 1 при state
 * 'denied'/'prompt') ретраям не подлежит — браузер отвечает мгновенно.
 *
 * @returns координаты с точностью или null при отказе/ошибке
 */
export function useGeolocation() {
  const coords = ref<{ lat: number; lng: number } | null>(readLastPos())
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Одна попытка первого API-browser: резолв позицией либо reject.
   *
   * @param opts настройки точности и таймаутов
   */
  function singleAttempt(opts: PositionOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, opts)
    })
  }

  async function requestGeolocation(): Promise<{ lat: number; lng: number; accuracy: number | null } | null> {
    loading.value = true
    error.value = null

    try {
      if (!navigator.geolocation) {
        error.value = 'Геолокация недоступна'
        return null
      }

      let position: GeolocationPosition | null = null
      let lastError: unknown = null

      try {
        position = await singleAttempt({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
      } catch (err) {
        lastError = err
        logGeolocationFailure(err)

        const isDenied = (err as GeolocationPositionError)?.code === 1

        if (isDenied) {
          // Глюк Chrome после выдачи разрешения: первый вызов отвечает
          // PERMISSION_DENIED, все последующие работают. Если сайт
          // формально 'granted', слегка ждём и доверяем ретраю.
          const state = await permissionState()

          if (state === 'granted') {
            await new Promise((resolve) => setTimeout(resolve, 500))

            try {
              position = await singleAttempt({ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 })
            } catch (retryErr) {
              lastError = retryErr
              logGeolocationFailure(retryErr)
            }
          }

          const finalState = await permissionState()

          if (!position && finalState !== 'granted') {
            // Отказ настоящий — site-level запрет, ретраить бессмысленно.
            error.value = describeError(lastError)
            return null
          }
        }
      }

      if (!position) {
        // GPS не отвечает — пробуем грубую сеть/Wi-Fi позицию.
        try {
          position = await singleAttempt({ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60000 })
        } catch (fallbackErr) {
          logGeolocationFailure(fallbackErr)
          const cached = readLastPos()

          if (cached) {
            return { ...cached, accuracy: null }
          }

          error.value = describeError(fallbackErr)
          return null
        }
      }

      const next = { lat: position.coords.latitude, lng: position.coords.longitude }
      coords.value = next
      try {
        localStorage.setItem(LAST_POS_KEY, JSON.stringify(next))
      } catch {}

      const accuracy = Number(position.coords.accuracy)
      return { ...next, accuracy: Number.isFinite(accuracy) ? accuracy : null }
    } finally {
      loading.value = false
    }
  }

  return { coords, loading, error, requestGeolocation }
}
