import { computed, ref, watch } from 'vue'
import type { SwipeCard } from '@/services/dating.api'

/**
 * Сториз-просмотр фото кандидата в свайпах.
 *
 * Открывается по отдельной иконке на карточке.
 * Полоски сверху зависят от числа фото, лимит 3, для PRO 5.
 *
 * @example
 * const viewer = useSwipePhotoViewer()
 * viewer.open(card)
 */
export function useSwipePhotoViewer() {
  const card = ref<SwipeCard | null>(null)
  const photoIndex = ref(0)
  const viewerOpen = ref(false)

  const photos = computed(() => {
    const list = card.value?.photos ?? []
    const limit = card.value?.is_pro ? 5 : 3
    return list.slice(0, limit)
  })

  const total = computed(() => photos.value.length)
  const currentPhoto = computed(() => photos.value[photoIndex.value] ?? null)
  const hasPhotos = computed(() => total.value > 0)
  const hasMultiple = computed(() => total.value > 1)
  const counterLabel = computed(() => {
    if (!total.value) {
      return ''
    }
    return `${photoIndex.value + 1}/${total.value}`
  })

  /**
   * Открыть просмотр фото кандидата.
   *
   * @param target карточка кандидата
   * @returns void
   */
  function open(target: SwipeCard): void {
    card.value = target
    photoIndex.value = 0
    viewerOpen.value = true
  }

  /**
   * Закрыть просмотр.
   *
   * @returns void
   */
  function close(): void {
    viewerOpen.value = false
  }

  /**
   * Показать следующее фото.
   *
   * @returns void
   */
  function next(): void {
    if (!total.value) {
      return
    }
    if (photoIndex.value < total.value - 1) {
      photoIndex.value += 1
    }
  }

  /**
   * Показать предыдущее фото.
   *
   * @returns void
   */
  function prev(): void {
    if (photoIndex.value > 0) {
      photoIndex.value -= 1
    }
  }

  /**
   * Перейти к конкретному фото по полоске.
   *
   * @param at индекс фото
   * @returns void
   */
  function goTo(at: number): void {
    if (at < 0 || at >= total.value) {
      return
    }
    photoIndex.value = at
  }

  /**
   * Обработать клавиатуру в открытом просмотре.
   *
   * @param event событие клавиатуры
   * @returns void
   */
  function onKeydown(event: KeyboardEvent): void {
    if (!viewerOpen.value) {
      return
    }
    if (event.key === 'Escape') {
      close()
    }
    if (event.key === 'ArrowRight') {
      next()
    }
    if (event.key === 'ArrowLeft') {
      prev()
    }
  }

  watch(viewerOpen, (isOpen) => {
    if (isOpen) {
      window.addEventListener('keydown', onKeydown)
    } else {
      window.removeEventListener('keydown', onKeydown)
      photoIndex.value = 0
    }
  })

  return {
    card,
    photos,
    total,
    photoIndex,
    currentPhoto,
    hasPhotos,
    hasMultiple,
    counterLabel,
    viewerOpen,
    open,
    close,
    next,
    prev,
    goTo,
  }
}
