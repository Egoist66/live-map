import { ref, computed } from 'vue'
import { usePinsStore } from '@/stores/pins'

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

  const filteredPins = computed(() =>
    selectedCategory.value === 'all' ? store.pins : store.pins.filter((p: any) => p.category === selectedCategory.value)
  )

  async function fetchNearby(lat: number, lng: number) {
    await store.fetchNearby(lat, lng)
  }

  async function createPin(payload: any) {
    return await store.createPin(payload)
  }

  function addRealtime(pin: any) { store.addRealtime(pin) }
  function removeRealtime(id: number) { store.removeRealtime(id) }

  return { store, categories, selectedCategory, filteredPins, fetchNearby, createPin, addRealtime, removeRealtime }
}
