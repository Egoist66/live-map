import { watch, type Ref } from 'vue'
import { useSwipe } from '@vueuse/core'

/**
 * Опции закрытия свайпом вниз.
 */
export interface SwipeToCloseOptions {
  /** Сколько px вниз нужно потянуть для закрытия (по умолчанию 90). */
  thresholdPx?: number
  /** Колбэк закрытия (вызывается один раз за жест). */
  onClose: () => void
  /** Геттер разрешения (например, не закрывать несвайпаемые алерты). */
  enabled?: () => boolean
}

/**
 * Закрытие оверлея свайпом вниз с живой тянучкой за пальцем.
 *
 * Вешается на карточку/шапку модалки: пока палец тянет вниз,
 * элемент едет за ним (`translateY`), при отпускании за порогом —
 * `onClose`, иначе плавно возвращается. Горизонтальные жесты
 * и скролл контента не трогаем: тянем только вертикально вниз.
 *
 * @param target элемент модалки (шапка или вся карточка)
 * @param options порог, колбэк закрытия и геттер разрешения
 * @returns состояние свайпа из `useSwipe` для кастомных индикаторов
 * @example
 * const cardRef = ref<HTMLElement | null>(null)
 * useSwipeToClose(cardRef, { onClose: () => emit('close') })
 * // <div ref="cardRef">…</div>
 */
export function useSwipeToClose(target: Ref<HTMLElement | null>, options: SwipeToCloseOptions) {
  const threshold = options.thresholdPx ?? 90

  function isEnabled(): boolean {
    return options.enabled?.() ?? true
  }

  function dragOffset(): number {
    const el = target.value
    if (!el || !isEnabled()) {
      return 0
    }
    const vertical = Math.abs(swipe.lengthY.value)
    const horizontal = Math.abs(swipe.lengthX.value)
    const pullingDown = swipe.lengthY.value < 0 && vertical > horizontal
    if (!swipe.isSwiping.value || !pullingDown) {
      return 0
    }
    return Math.min(-swipe.lengthY.value, 220)
  }

  function paintDrag(): void {
    const el = target.value
    if (!el) {
      return
    }
    const offset = dragOffset()
    if (offset > 0) {
      el.style.transition = 'none'
      el.style.transform = `translateY(${offset}px)`
      return
    }
    el.style.transition = ''
    el.style.transform = ''
  }

  function snapBack(): void {
    const el = target.value
    if (!el) {
      return
    }
    el.style.transition = 'transform 0.22s ease'
    el.style.transform = ''
  }

  function onSwipeEnd(_event: TouchEvent, direction: string): void {
    if (!isEnabled()) {
      snapBack()
      return
    }
    const pulled = -swipe.lengthY.value
    const farEnough = direction === 'down' && pulled >= threshold
    if (farEnough) {
      snapBack()
      options.onClose()
      return
    }
    snapBack()
  }

  const swipe = useSwipe(target, {
    threshold: 12,
    passive: true,
    onSwipeEnd,
  })

  watch([() => swipe.lengthY.value, () => swipe.isSwiping.value], paintDrag)

  return { isSwiping: swipe.isSwiping, direction: swipe.direction, lengthY: swipe.lengthY }
}
