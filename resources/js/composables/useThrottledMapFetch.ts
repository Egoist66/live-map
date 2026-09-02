import { ref } from 'vue'
import { usePins } from '@/composables/usePins'

export function useThrottledMapFetch(onDone?: () => void) {
  const { fetchNearby, store } = usePins() as any
  let lastFetch = 0
  let lastPos = { lat: 0, lng: 0 }
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false
  const MIN_DIST = 0.003
  const DEBOUNCE = 900
  const THROTTLE = 3000

  function request(lat: number, lng: number) {
    const dist = Math.hypot(lat - lastPos.lat, lng - lastPos.lng)
    const now = Date.now()
    if (dist < MIN_DIST && now - lastFetch < THROTTLE) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(async () => {
      if (pending) return
      pending = true
      try {
        await fetchNearby(lat, lng)
        lastFetch = Date.now()
        lastPos = { lat, lng }
        onDone?.()
      } finally {
        pending = false
      }
    }, DEBOUNCE)
  }

  function flush(lat: number, lng: number) {
    if (timer) clearTimeout(timer)
    pending = false
    return fetchNearby(lat, lng).then(() => {
      lastFetch = Date.now()
      lastPos = { lat, lng }
      onDone?.()
    })
  }

  return { request, flush }
}
