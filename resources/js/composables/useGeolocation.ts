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

export function useGeolocation() {
  const coords = ref<{ lat: number; lng: number } | null>(readLastPos())
  const loading = ref(false)
  const error = ref<string | null>(null)

  function requestGeolocation(): Promise<{ lat: number; lng: number } | null> {
    loading.value = true
    error.value = null
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        loading.value = false
        error.value = 'Геолокация недоступна'
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          coords.value = next
          try { localStorage.setItem(LAST_POS_KEY, JSON.stringify(next)) } catch {}
          loading.value = false
          resolve(next)
        },
        (err) => {
          error.value = err?.code === 1 ? 'Геолокация отклонена' : 'Не удалось определить позицию'
          loading.value = false
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
      )
    })
  }

  return { coords, loading, error, requestGeolocation }
}
