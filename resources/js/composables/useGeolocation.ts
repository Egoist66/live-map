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
 * Понятная причина отказа с учётом фактического состояния разрешения.
 *
 * Браузер может отказать на первый вызов сразу после выдачи разрешения.
 * Такой случай не повод пугать юзера «включи разрешение»: настоящий
 * site-level запрет ловим по state 'denied'/'prompt'.
 *
 * @param err ошибка браузерного geolocation API
 * @param state состояние разрешения 'granted' | 'denied' | 'prompt' | null
 * @returns текст для тоста/карточки
 */
function describeError(err: unknown, state: string | null): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Геолокация работает только по https или localhost — сейчас открыт незащищённый адрес'
  }

  const code = (err as GeolocationPositionError | null | undefined)?.code

  if (code === 1) {
    const actuallyDenied = state !== 'granted'

    if (actuallyDenied) {
      return 'Браузер запретил доступ к местоположению для сайта. Нажми значок замка слева от адреса → «Разрешить» и обнови страницу'
    }

    return 'Разрешение есть, но система не отдала позицию. Подожди пару секунд и нажми «Определить» ещё раз'
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
}

/** Пауза между ретраями. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Одноразовый запрос геопозиции с каскадом попыток.
 *
 * Первый вызов после выдачи разрешения может завершиться отказом,
 * поэтому попытки три: 1) точный GPS (enableHighAccuracy) — 2) пауза
 * 700 мс и снова точный — 3) грубая сеть/Wi-Fi позиция. Отказ при
 * state != 'granted' — быстрее честное «разреши в браузере», ретраить
 * бессмысленно. Последний шанс — кэш последней удачной фиксации.
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

      // Точный запрос дублируем: первый вызов может закрыться отказом.
      const attempts: PositionOptions[] = [
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
      ]

      let position: GeolocationPosition | null = null
      let lastError: unknown = null

      for (let attemptIndex = 0; attemptIndex < attempts.length; attemptIndex += 1) {
        if (attemptIndex > 0) {
          await delay(700)
        }

        try {
          position = await singleAttempt(attempts[attemptIndex])
          break
        } catch (err) {
          lastError = err
          logGeolocationFailure(err)

          if ((err as GeolocationPositionError)?.code !== 1) {
            continue
          }

          const state = await permissionState()

          if (state !== 'granted') {
            // Настоящий запрет сайта — ретраить бессмысленно.
            break
          }

          // Разрешение формально есть — повторяем запрос.
        }
      }

      if (!position) {
        // Все попытки провалились: кэш последней удачной фиксации.
        const cached = readLastPos()

        if (cached) {
          return { ...cached, accuracy: null }
        }

        const permState = await permissionState()
        error.value = describeError(lastError, permState)

        return null
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
