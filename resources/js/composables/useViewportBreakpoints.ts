import { computed, onMounted, onUnmounted, ref } from 'vue'

/**
 * Брейкпоинты адаптива для узких экранов.
 *
 * Держит вся логику определения компактного вьюпорта в одном месте,
 * чтобы компоненты только читали флаги и не вешали свои листенеры.
 *
 * @returns Флаги компактности и текущая ширина вьюпорта
 * @example
 * const { isXs } = useViewportBreakpoints()
 * // isXs.value === true при ширине <= 410px
 */
export function useViewportBreakpoints() {
  const width = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)

  const updateWidth = (): void => {
    width.value = window.innerWidth
  }

  onMounted(() => {
    updateWidth()
    window.addEventListener('resize', updateWidth, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('resize', updateWidth)
  })

  const isXs = computed(() => width.value <= 410)
  const isXxs = computed(() => width.value <= 360)
  const isMobile = computed(() => width.value < 640)
  const isTablet = computed(() => width.value >= 640 && width.value < 1024)

  return { width, isXs, isXxs, isMobile, isTablet }
}
