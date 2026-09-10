import { computed, ref, watch } from 'vue'
import type { SwipeCard } from '@/services/dating.api'

/**
 * Листание фото кандидата прямо на свайп-карточке.
 *
 * Число черточек-полосок зависит от числа фото: free — до 3, PRO — до 5.
 * Индекс сбрасывается при смене карточки.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useSwipeCardPhotos } from '@/composables/useSwipeCardPhotos'
 * const cardPhotos = useSwipeCardPhotos(() => s.current.value)
 * </script>
 * ```
 *
 * @param card геттер текущей карточки
 * @returns фото, индекс и действия листания
 */
export function useSwipeCardPhotos(card: () => SwipeCard | null) {
  const photoIndex = ref(0)

  const photos = computed(() => {
    const list = card()?.photos ?? []
    const limit = card()?.is_pro ? 5 : 3
    return list.slice(0, limit)
  })

  const total = computed(() => photos.value.length)
  const currentPhoto = computed(() => photos.value[photoIndex.value] ?? null)
  const hasPhotos = computed(() => total.value > 0)
  const hasMultiple = computed(() => total.value > 1)

  /**
   * Перейти к конкретному фото по полоске.
   * @param at индекс фото
   */
  function goTo(at: number): void {
    if (at < 0 || at >= total.value) {
      return
    }
    photoIndex.value = at
  }

  /**
   * Сбросить на первое фото (при смене карточки).
   */
  function reset(): void {
    photoIndex.value = 0
  }

  watch(
    () => card()?.id,
    () => reset(),
  )

  return { photos, total, photoIndex, currentPhoto, hasPhotos, hasMultiple, goTo, reset }
}
