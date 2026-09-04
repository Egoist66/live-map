import { onMounted, ref } from 'vue'
import { usePwa } from '@/composables/usePwa'
import { clearRuntimeCaches, getEstimate } from '@/pwa/cache.service'
import type { StorageEstimate } from '@/pwa/cache.service'

const usage = ref<StorageEstimate | null>(null)
const clearing = ref(false)
const loaded = ref(false)

export function usePwaSettings() {
  const pwa = usePwa()
  const { init } = pwa

  async function loadStorage(): Promise<void> {
    try {
      usage.value = await getEstimate()
    } catch {
      usage.value = null
    }
  }

  async function clearCache(): Promise<void> {
    if (clearing.value) return
    clearing.value = true
    try {
      await clearRuntimeCaches()
      await loadStorage()
    } finally {
      clearing.value = false
    }
  }

  onMounted(async () => {
    await init()
    await loadStorage()
    loaded.value = true
  })

  return { ...pwa, usage, clearing, loaded, loadStorage, clearCache }
}
