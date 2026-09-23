import { ref, computed } from 'vue'
import { usePinsStore } from '@/stores/pins'
import { isPinAlive } from '@/composables/usePinExpiry'
import { PIN_CATEGORIES } from '@/composables/pinCategories'
import type { Pin, CreatePinPayload } from '@/types/entities/Pin'

export { PIN_CATEGORIES, pinCategoryMeta } from '@/composables/pinCategories'
export type { PinCategoryValue } from '@/composables/pinCategories'

const selectedCategory = ref('all')

export function usePins() {
  const store = usePinsStore()

  const categories = PIN_CATEGORIES

  const filteredPins = computed(() => {
    const alive = (store.pins as any[]).filter((p) => isPinAlive(p))
    if (selectedCategory.value === 'all') return alive
    if (selectedCategory.value === 'mine') return alive.filter((p) => p.is_owner)
    return alive.filter((p) => p.category === selectedCategory.value)
  })

  function fetchNearby(lat: number, lng: number, radius?: number, userPos?: { lat: number; lng: number } | null) {
    return store.fetchNearby(lat, lng, radius, userPos ?? null)
  }

  function createPin(payload: CreatePinPayload): Promise<Pin> {
    return store.createPin(payload)
  }

  return {
    store,
    categories,
    selectedCategory,
    filteredPins,
    fetchNearby,
    createPin,
    addRealtime: (pin: Pin) => store.addRealtime(pin),
    removeRealtime: (id: number) => store.removeRealtime(id),
  }
}
