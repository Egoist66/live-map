import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useBadgeStore } from '@/stores/badges'

/**
 * Состояние нижней мобильной навигации.
 *
 * Прячет меню при открытой клавиатуре, чтобы инпуты чата/комментариев
 * не уезжали под навигацию в WebView и мобильном браузере.
 *
 * @returns ссылки, активность, бейджи и флаг скрытия клавиатурой
 * @example
 * const { dashboardHref, isActive, total, navHidden } = useMobileBottomNav()
 */
export function useMobileBottomNav() {
  const badge = useBadgeStore()
  const keyboardOpen = ref(false)

  const dashboardHref = computed(() => route('dashboard'))
  const total = computed(() => badge.unread)

  /**
   * Проверяет активность пункта меню.
   *
   * @param name имя роута
   * @returns true если роут текущий
   */
  function isActive(name: string): boolean {
    return route().current(name)
  }

  const navHidden = computed(() => keyboardOpen.value)

  /**
   * Десктоп с физической клавиатурой: visualViewport не сжимается,
   * фокус в инпуте не означает экранную клавиатуру. Иначе фокус
   * в поле чата на десктопе добавлял бы `native-keyboard-open`
   * и дёргал высоту `.h-app-full` вниз/вверх.
   *
   * @returns true на ширине десктопа (lg и шире)
   */
  function isDesktopViewport(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(min-width: 1024px)').matches
  }

  /**
   * Пересчитывает признак открытой клавиатуры по visualViewport.
   *
   * @returns void
   */
  function recalcKeyboard(): void {
    if (isDesktopViewport()) {
      keyboardOpen.value = false
      return
    }
    const viewport = window.visualViewport
    if (!viewport) {
      keyboardOpen.value = false
      return
    }
    const diff = window.innerHeight - viewport.height - viewport.offsetTop
    keyboardOpen.value = diff > 80
  }

  /**
   * Синхронизирует класс на <html> для CSS-скрытия меню.
   *
   * @returns void
   */
  function syncHtmlClass(): void {
    const root = document.documentElement
    if (keyboardOpen.value) {
      root.classList.add('native-keyboard-open')
      return
    }
    root.classList.remove('native-keyboard-open')
  }

  /**
   * Обработчик фокуса: клавиатура почти наверняка открыта в поле ввода.
   *
   * @param event событие фокуса
   * @returns void
   */
  function onFocusIn(event: FocusEvent): void {
    if (isDesktopViewport()) {
      return
    }
    const target = event.target as HTMLElement | null
    const tag = target?.tagName ?? ''
    const isField = tag === 'INPUT' || tag === 'TEXTAREA'
    if (!isField) {
      return
    }
    keyboardOpen.value = true
    syncHtmlClass()
  }

  /**
   * Обработчик потери фокуса: даём клавиатуре закрыться и пересчитываем.
   *
   * @returns void
   */
  function onFocusOut(): void {
    window.setTimeout(() => {
      recalcKeyboard()
      syncHtmlClass()
    }, 120)
  }

  /**
   * Обработчик ресайза вьюпорта (открытие/закрытие клавиатуры).
   *
   * @returns void
   */
  function onViewportChange(): void {
    recalcKeyboard()
    syncHtmlClass()
  }

  onMounted(() => {
    const viewport = window.visualViewport
    if (viewport) {
      viewport.addEventListener('resize', onViewportChange)
      viewport.addEventListener('scroll', onViewportChange)
    }
    window.addEventListener('resize', onViewportChange)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    recalcKeyboard()
    syncHtmlClass()
  })

  onBeforeUnmount(() => {
    const viewport = window.visualViewport
    if (viewport) {
      viewport.removeEventListener('resize', onViewportChange)
      viewport.removeEventListener('scroll', onViewportChange)
    }
    window.removeEventListener('resize', onViewportChange)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    document.documentElement.classList.remove('native-keyboard-open')
  })

  return { dashboardHref, isActive, total, navHidden, keyboardOpen }
}
