import { computed, onMounted, ref } from 'vue'
import { pinsApi } from '@/services/pins.api'
import type { Pin } from '@/types/entities/Pin'

/**
 * Пины компании в кабинете: полный список со статистикой.
 *
 * @returns пины, итоги и загрузку
 * @example const list = useBusinessPins()
 */
export function useBusinessPins() {
  const pins = ref<Pin[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const totals = computed(() => {
    let views = 0
    let likes = 0
    let comments = 0
    for (const pin of pins.value) {
      views += Number(pin.views_count ?? 0)
      likes += Number(pin.likes_count ?? 0)
      comments += Number(pin.comments_count ?? 0)
    }
    return { count: pins.value.length, views, likes, comments }
  })

  /**
   * Загрузить свои пины.
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      pins.value = await pinsApi.mine()
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      error.value = message ?? 'Не удалось загрузить пины'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void load()
  })

  return { pins, loading, error, totals, load }
}
