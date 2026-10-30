import { computed } from 'vue'

/**
 * Классы и стили раскладки чата.
 *
 * Высота фрейма считается через CSS-класс `h-app-full` (шапка + нижнее меню
 * + safe-area). Ручной оффсет клавиатуры применяется только на вебе,
 * только не на десктопе и никогда на iOS (там `100dvh` уже сжимается
 * клавиатурой через `interactive-widget=resizes-content`, повторное
 * вычитание сплющивало бы фрейм).
 *
 * @param keyboardHeight высота клавиатуры из useChatViewport
 * @param isChatKeyboardOpen true когда клавиатура открыта в поле сообщения
 * @returns классы карточек и стиль фрейма
 * @example
 * const { keyboardHeight, isChatKeyboardOpen } = useChatViewport()
 * const { pageClass, frameClass, frameStyle } = useChatLayout(keyboardHeight, isChatKeyboardOpen)
 */
export function useChatLayout(
  keyboardHeight?: { value: number },
  isChatKeyboardOpen?: { value: boolean },
) {
  const pageClass = 'mx-auto max-w-[1280px] xl:max-w-[1400px] 2xl:max-w-[1600px] w-full min-w-0 overflow-hidden overscroll-none p-0 lg:px-6 lg:py-4'
  const frameClass = 'flex flex-col lg:flex-row lg:gap-4 w-full min-w-0 overflow-hidden overscroll-contain bg-transparent'
  const sidebarCardClass = 'w-full lg:w-[360px] lg:min-w-[360px] xl:w-[400px] xl:min-w-[400px] 2xl:w-[440px] 2xl:min-w-[440px] flex-1 lg:flex-none min-h-0 lg:h-full lg:max-h-full bg-white dark:bg-[#0F121F] rounded-none lg:rounded-2xl border-0 lg:border border-stone-200 dark:border-zinc-800 flex-col overflow-hidden max-w-full'
  const windowCardClass = 'flex-1 min-h-0 bg-white dark:bg-[#0F121F] rounded-none lg:rounded-2xl border-0 lg:border border-stone-200 dark:border-zinc-800 flex-col overflow-hidden min-w-0 w-full max-w-full'

  /**
   * Ручной оффсет клавиатуры запрещён на десктопе: высота фрейма
   * там стабильна через `h-app-full`, иначе инпут дёргался бы.
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
   * iOS Safari / PWA / WKWebView: `interactive-widget=resizes-content`
   * (см. app.blade.php) уже сжимает `100dvh` вместе с клавиатурой —
   * класс `h-app-full` сам встаёт над клавиатурой. Ручной оффсет
   * `keyboardHeight` вычитал бы клавиатуру второй раз и сплющивал
   * фрейм: окно диалога и инпут сжимались в полоску.
   *
   * @returns true на iOS (iPhone/iPad/iPod + iPadOS-маскарад под Mac)
   */
  function isIOS(): boolean {
    if (typeof navigator === 'undefined') {
      return false
    }
    const ua = String(navigator.userAgent ?? '')
    if (/iPad|iPhone|iPod/.test(ua)) {
      return true
    }
    const platform = String((navigator as Navigator & { platform?: string }).platform ?? '')
    const maxTouch = Number((navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0)
    return platform === 'MacIntel' && maxTouch > 1
  }

  const frameStyle = computed(() => {
    if (isDesktopViewport()) {
      return {}
    }
    if (isIOS()) {
      return {}
    }
    const open = isChatKeyboardOpen?.value ?? false
    const height = keyboardHeight?.value ?? 0
    if (!open || !height) {
      return {}
    }
    const offset = `calc(100dvh - var(--app-header-sm) - var(--sat) - ${height}px)`
    return { height: offset, maxHeight: offset }
  })

  return { pageClass, frameClass, sidebarCardClass, windowCardClass, frameStyle }
}
