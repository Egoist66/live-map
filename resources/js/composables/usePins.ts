import { ref, computed } from 'vue'
import { usePinsStore } from '@/stores/pins'
import { isPinAlive } from '@/composables/usePinExpiry'
import type { Pin, CreatePinPayload } from '@/types/entities/Pin'

const selectedCategory = ref('all')

export const PIN_CATEGORIES = [
  { v: 'sos', l: 'SOS', i: '🆘', c: '#B91C1C' },
  { v: 'question', l: 'Вопрос', i: '💬', c: '#2563EB' },
  { v: 'announcement', l: 'Объявление', i: '📍', c: '#DC2626' },
  { v: 'warning', l: 'Предупреждение', i: '⚠️', c: '#EA580C' },
  { v: 'event', l: 'Событие', i: '🎉', c: '#7C3AED' },
  { v: 'offer', l: 'Отдам', i: '📦', c: '#0891B2' },
  { v: 'help', l: 'Помощь', i: '🤝', c: '#DB2777' },
  { v: 'sport', l: 'Спорт', i: '🏃', c: '#16A34A' },
  { v: 'food', l: 'Еда', i: '🍔', c: '#F59E0B' },
  { v: 'music', l: 'Музыка', i: '🎵', c: '#8B5CF6' },
  { v: 'pets', l: 'Животные', i: '🐾', c: '#0D9488' },
  { v: 'sale', l: 'Купля-продажа', i: '💰', c: '#A16207' },
  { v: 'job', l: 'Работа', i: '💼', c: '#475569' },
  { v: 'study', l: 'Учёба', i: '📚', c: '#0284C7' },
  { v: 'travel', l: 'Путешествия', i: '🧭', c: '#65A30D' },
  { v: 'tech', l: 'Технологии', i: '💻', c: '#4F46E5' },
  { v: 'health', l: 'Здоровье', i: '🏥', c: '#E11D48' },
  { v: 'art', l: 'Творчество', i: '🎨', c: '#D946EF' },
  { v: 'humor', l: 'Юмор', i: '😂', c: '#EAB308' },
  { v: 'rest', l: 'Отдых', i: '🏖️', c: '#38BDF8' },
] as const

export type PinCategoryValue = (typeof PIN_CATEGORIES)[number]['v']

export function pinCategoryMeta(v: string | null | undefined) {
  return (PIN_CATEGORIES as readonly any[]).find((c) => c.v === v) ?? null
}

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
