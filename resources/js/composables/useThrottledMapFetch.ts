import { ref } from 'vue'
import { usePins } from '@/composables/usePins'

/**
 * Троттлинг догрузки пинов по движению карты.
 *
 * Панорамирование шлёт moveend на каждый жест + zoomend на зум: без
 * дебаунса и дистанции это десятки /api/pins в минуту, которые вместе
 * с тиком realtime/sync и бейджами упираются в общий throttle:120,1 (429).
 * После 429 держим паузу 15с, скрытая вкладка запросы не шлёт.
 *
 * @param onDone колбэк перерисовки после удачного fetch
 */
export function useThrottledMapFetch(onDone?: () => void) {
  const { fetchNearby, store } = usePins() as any
  let lastFetch = 0
  let lastPos = { lat: 0, lng: 0 }
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false
  let blockedUntil = 0
  const MIN_DIST = 0.005
  const DEBOUNCE = 1200
  const THROTTLE = 5000
  const BLOCK_AFTER_429 = 15000

  function request(lat: number, lng: number, radius?: number) {
    const now = Date.now()
    if (now < blockedUntil) {
      return
    }
    if (typeof document !== 'undefined' && document.hidden) {
      return
    }
    const dist = Math.hypot(lat - lastPos.lat, lng - lastPos.lng)
    if (dist < MIN_DIST && now - lastFetch < THROTTLE) {
      return
    }
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(async () => {
      if (pending) {
        return
      }
      pending = true
      try {
        await fetchNearby(lat, lng, radius)
        lastFetch = Date.now()
        lastPos = { lat, lng }
        onDone?.()
      } catch (e: any) {
        if (Number(e?.response?.status) === 429) {
          blockedUntil = Date.now() + BLOCK_AFTER_429
        }
      } finally {
        pending = false
      }
    }, DEBOUNCE)
  }

  async function flush(lat: number, lng: number, radius?: number) {
    if (timer) {
      clearTimeout(timer)
    }
    pending = false
    try {
      await fetchNearby(lat, lng, radius)
      lastFetch = Date.now()
      lastPos = { lat, lng }
      onDone?.()
    } catch (e: any) {
      if (Number(e?.response?.status) === 429) {
        blockedUntil = Date.now() + BLOCK_AFTER_429
      }
      throw e
    }
  }

  return { request, flush }
}
