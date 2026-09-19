import { ref } from 'vue'
import { flowApi } from '@/services/flow.api'
import type { FlowTag } from '@/types/flow'

const trending = ref<FlowTag[]>([])
const loading = ref(false)
let loadedAt = 0
const CACHE_TTL_MS = 60_000

/**
 * Хэштеги UFlow: тренды для чипов над лентой.
 *
 * Список кешируется на минуту — чипы не должны дёргать
 * сервер на каждой навигации.
 *
 * @example
 * const tags = useFlowTags()
 * await tags.load()
 */
export function useFlowTags() {
  /**
   * Загрузить тренды (из кеша если свежие).
   * @param force игнорировать кеш
   */
  async function load(force = false): Promise<void> {
    if (!force && Date.now() - loadedAt < CACHE_TTL_MS && trending.value.length) return
    loading.value = true
    try {
      trending.value = await flowApi.trendingTags(10)
      loadedAt = Date.now()
    } catch {
      trending.value = []
    } finally {
      loading.value = false
    }
  }

  return { trending, loading, load }
}
