import { onBeforeUnmount, onMounted } from 'vue'
import { acquireScrollLock, releaseScrollLock } from '@/composables/useScrollLock'

/**
 * Блокирует скролл страницы на время жизни компонента (чат на всю страницу).
 * Лок идёт через общий ref-counted менеджер, поэтому корректно
 * комбинируется с модалками поверх.
 */
export function usePageScrollLock() {
  const owner = 'page-scroll-lock'
  let prevGutter = ''
  onMounted(() => {
    if (typeof document === 'undefined') return
    prevGutter = document.documentElement.style.scrollbarGutter
    document.documentElement.style.scrollbarGutter = 'auto'
    acquireScrollLock(owner)
  })
  onBeforeUnmount(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.scrollbarGutter = prevGutter
    }
    releaseScrollLock(owner)
  })
}
