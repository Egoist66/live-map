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
      await new Promise((r) => setTimeout(r, 400))
      const after = await loadStorage()
      const freed = before && after ? Math.max(0, before.usageMB - after.usageMB) : null
      lastCleared.value =
        deleted.length === 0
          ? 'Кеш уже пуст — очищать нечего'
          : `Очищено разделов: ${deleted.length}` + (freed !== null ? ` · освобождено ~${freed.toFixed(1)} МБ` : '')
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
