import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { SwipeCard } from '@/services/dating.api'

/**
 * Листание фото кандидата прямо на свайп-карточке.
 *
 * Число черточек-полосок зависит от числа фото: free — до 3, PRO — до 5.
 * По умолчанию фото сами листаются каждые 5 секунд и останавливаются на последнем.
 * Индекс и таймер сбрасываются при смене карточки и ручном переходе.
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
 * @param autoplayMs интервал автолистания в мс, по умолчанию 5000
 * @returns фото, индекс и действия листания
 */
export function useSwipeCardPhotos(card: () => SwipeCard | null, autoplayMs = 5000) {
  const photoIndex = ref(0)
  let timer: ReturnType<typeof setInterval> | null = null
  let downX = 0
  let downY = 0
  let downAt = 0

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
   * Перейти к конкретному фото по полоске, таймер начинается заново.
   * @param at индекс фото
   */
  function goTo(at: number): void {
    if (at < 0 || at >= total.value) {
      return
    }
    photoIndex.value = at
    restartAutoplay()
  }

  /**
   * Следующее фото, стоп на последнем.
   */
  function next(): void {
    if (photoIndex.value < total.value - 1) {
      photoIndex.value += 1
      restartAutoplay()
    }
  }

  /**
   * Предыдущее фото, стоп на первом.
   */
  function prev(): void {
    if (photoIndex.value > 0) {
      photoIndex.value -= 1
      restartAutoplay()
    }
  }

  /**
   * Запомнить точку нажатия для отличия тапа от свайпа.
   * @param e событие нажатия
   */
  function tapDown(e: PointerEvent): void {
    downX = e.clientX
    downY = e.clientY
    downAt = Date.now()
  }

  /**
   * Тап по фото как в сторис: левая треть — назад, остальное — вперёд.
   * Свайпы и клики по кнопкам не трогает. Вызывать на pointerup оверлея.
   * @param e событие отпускания
   * @returns true если это был тап по фото
   */
  function tapUp(e: PointerEvent): boolean {
    try {
      const target = e.target as HTMLElement | null
      if (target?.closest?.('button, a')) {
        return false
      }
      const dx = e.clientX - downX
      const dy = e.clientY - downY
      if (Math.hypot(dx, dy) > 12 || Date.now() - downAt > 500) {
        return false
      }
      const host = e.currentTarget as HTMLElement | null
      const rect = host?.getBoundingClientRect?.()
      if (!rect || rect.width <= 0) {
        return false
      }
      if ((e.clientX - rect.left) / rect.width < 0.3) {
        prev()
      } else {
        next()
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Сбросить на первое фото (при смене карточки).
   */
  function reset(): void {
    photoIndex.value = 0
  }

  /**
   * Остановить автолистание.
   */
  function stopAutoplay(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  /**
   * Запустить автолистание заново: каждые N секунд следующее фото, стоп на последнем.
   */
  function restartAutoplay(): void {
    stopAutoplay()
    if (total.value < 2) {
      return
    }
    timer = setInterval(() => {
      if (photoIndex.value >= total.value - 1) {
        stopAutoplay()
        return
      }
      photoIndex.value += 1
    }, autoplayMs)
  }

  watch(
    () => card()?.id,
    () => {
      reset()
      restartAutoplay()
    },
  )

  onMounted(() => restartAutoplay())
  onBeforeUnmount(() => stopAutoplay())

  return { photos, total, photoIndex, currentPhoto, hasPhotos, hasMultiple, intervalMs: autoplayMs, goTo, next, prev, reset, restartAutoplay, stopAutoplay, tapDown, tapUp }
}
