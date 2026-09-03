import { ref, computed } from 'vue'
import { usePinsStore } from '@/stores/pins'
import type { Pin, CreatePinPayload } from '@/types/entities/Pin'

const selectedCategory = ref('all')

export function usePins() {
  const store = usePinsStore()

  const categories = [
    { v: 'question', l: 'Вопрос', i: '💬' },
    { v: 'announcement', l: 'Объявление', i: '📍' },
    { v: 'warning', l: 'Предупреждение', i: '⚠️' },
    { v: 'event', l: 'Событие', i: '🎉' },
    { v: 'offer', l: 'Отдам', i: '📦' },
    { v: 'help', l: 'Помощь', i: '🤝' },
  ] as const

  const filteredPins = computed(() => {
    if (selectedCategory.value === 'all') return store.pins
    if (selectedCategory.value === 'mine') return store.pins.filter((p) => p.is_owner)
    return store.pins.filter((p) => p.category === selectedCategory.value)
  })

  function fetchNearby(lat: number, lng: number, radius?: number) {
    return store.fetchNearby(lat, lng, radius)
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
