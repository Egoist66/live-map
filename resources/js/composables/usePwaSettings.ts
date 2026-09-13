import { onMounted, ref } from 'vue'
import { usePwa } from '@/composables/usePwa'
import { clearRuntimeCaches, getEstimate } from '@/pwa/cache.service'
import type { StorageEstimate } from '@/pwa/cache.service'

const usage = ref<StorageEstimate | null>(null)
const clearing = ref(false)
const loaded = ref(false)
const lastCleared = ref<string | null>(null)

/**
 * Настройки вкладки «Приложение»: PWA-статус и кэш.
 *
 * @returns состояние PWA и кэша
 * @example
 * const s = usePwaSettings()
 * await s.clearCache()
 */
export function usePwaSettings() {
  const pwa = usePwa()
  const { init } = pwa

  async function loadStorage(): Promise<StorageEstimate | null> {
    try {
      usage.value = await getEstimate()
    } catch {
      usage.value = null
    }
    return usage.value
  }

  async function clearCache(): Promise<void> {
    if (clearing.value) return
    clearing.value = true
    lastCleared.value = null
    try {
      const before = await loadStorage()
      const deleted = await clearRuntimeCaches()
      await new Promise((r) => setTimeout(r, 800))
      const after = await loadStorage()
      if (deleted.length === 0) {
        lastCleared.value = 'Кеш уже пуст — очищать нечего'
        return
      }
      const freed = before && after ? Math.max(0, before.usageMB - after.usageMB) : null
      const freedText = freed !== null && freed >= 0.1 ? ` · освобождено ~${freed.toFixed(1)} МБ` : ''
      const restMB = after ? after.usageMB : 0
      const restText = restMB >= 1 ? ` · осталось ~${restMB.toFixed(1)} МБ (оболочка и данные)` : ''
      lastCleared.value = `Очищено разделов: ${deleted.length}${freedText}${restText}`
    } finally {
      clearing.value = false
    }
  }

  onMounted(async () => {
    await init()
    await loadStorage()
    loaded.value = true
  })

  return { ...pwa, usage, clearing, loaded, lastCleared, loadStorage, clearCache }
}
