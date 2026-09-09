import type { Ref } from 'vue'

/**
 * Свайпы влево/вправо для переключения табов на тачскринах.
 * Вертикальный скролл не перехватывает: срабатывает только
 * выраженный горизонтальный жест.
 * @param tabs порядок табов
 * @param active активный таб
 * @param threshold минимальная длина свайпа в px
 * @returns обработчики touchstart/touchend
 * @example
 * const swipe = useSwipeTabs(['short', 'gallery', 'info'], tab)
 */
export function useSwipeTabs<T extends string>(tabs: readonly T[], active: Ref<T>, threshold = 60) {
  let startX = 0
  let startY = 0

  function onTouchStart(e: TouchEvent): void {
    const t = e.touches[0]
    if (!t) return
    startX = t.clientX
    startY = t.clientY
  }

  function onTouchEnd(e: TouchEvent): void {
    const t = e.changedTouches[0]
    if (!t) return
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const i = tabs.indexOf(active.value)
    const next = dx < 0 ? i + 1 : i - 1
    if (next >= 0 && next < tabs.length) active.value = tabs[next]
  }

  return { onTouchStart, onTouchEnd }
}
