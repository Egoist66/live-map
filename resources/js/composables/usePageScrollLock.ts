import { onBeforeUnmount, onMounted } from 'vue'
import { acquireScrollLock, releaseScrollLock } from '@/composables/useScrollLock'

/**
 * Блокирует скролл страницы на время жизни компонента (чат на всю страницу).
 * Лок идёт через общий ref-counted менеджер, поэтому корректно
 * комбинируется с модалками поверх.
 *
 * Захват идемпотентный: повторный mount без unmount (HMR, переиспользование
 * компонента Inertia при смене пропсов) не накручивает счётчик владельца —
 * иначе лишний голос вечно держал бы `overflow: hidden` после ухода
 * со страницы («скролл пропал» до перезагрузки).
 */
export function usePageScrollLock() {
  const owner = 'page-scroll-lock'
  let prevGutter = ''
  let held = false
  onMounted(() => {
    if (typeof document === 'undefined') return
    if (held) return
    held = true
    prevGutter = document.documentElement.style.scrollbarGutter
    document.documentElement.style.scrollbarGutter = 'auto'
    acquireScrollLock(owner)
  })
  onBeforeUnmount(() => {
    if (!held) return
    held = false
    if (typeof document !== 'undefined') {
      document.documentElement.style.scrollbarGutter = prevGutter
    }
    releaseScrollLock(owner)
  })
}
