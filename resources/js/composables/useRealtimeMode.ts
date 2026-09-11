import { ref, computed } from 'vue'
import { api } from '@/services/api'
import { busEmit, busOn } from '@/services/realtime-bus'

const mode = ref<string>('socket')
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
let loaded = false
let inflight: Promise<string> | null = null
let busAttached = false

/**
 * Режим транспорта realtime: socket (Reverb) или polling (REST-тик).
 *
 * Админ переключает из админки, пока действует лимит WS-соединений.
 * Обычные клиенты только читают режим и подстраивают транспорт.
 *
 * @example
 * const { isPolling, init, setMode } = useRealtimeMode()
 * await init()
 * if (isPolling.value) startPoller()
 */
export function useRealtimeMode() {
  const isPolling = computed(() => mode.value === 'polling')

  if (!busAttached) {
    busAttached = true
    busOn('realtime:mode', (next) => {
      const resolved = next === 'polling' ? 'polling' : 'socket'
      if (mode.value !== resolved) mode.value = resolved
    })
  }

  /**
   * Подтянуть режим с сервера (один раз, дальше дедуп).
   */
  async function init(): Promise<string> {
    if (loaded) return mode.value
    if (inflight) return inflight
    loading.value = true
    inflight = api
      .get('/api/realtime/mode')
      .then((r) => {
        const next = r.data?.mode === 'polling' ? 'polling' : 'socket'
        if (next !== mode.value) {
          mode.value = next
          busEmit('realtime:mode', next)
        }
        loaded = true
        return mode.value
      })
      .catch(() => mode.value)
      .finally(() => {
        loading.value = false
        inflight = null
      })
    return inflight
  }

  /**
   * Переключить режим (только админ).
   *
   * @param next socket|polling
   */
  async function setMode(next: string): Promise<void> {
    error.value = null
    saving.value = true
    try {
      const { data } = await api.post('/api/admin/realtime/mode', { mode: next })
      const resolved = data?.mode === 'polling' ? 'polling' : 'socket'
      mode.value = resolved
      loaded = true
      busEmit('realtime:mode', resolved)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось переключить режим'
      throw e
    } finally {
      saving.value = false
    }
  }

  return { mode, isPolling, loading, saving, error, init, setMode }
}
