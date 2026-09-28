/**
 * Сплэш: полноэкранный boot-экран (`#pwa-boot`) в стиле Tinder.
 *
 * Верхней линейной полосы при полной перезагрузке нет сознательно:
 * при переходах по страницам её рисует Inertia-progress,
 * а на перезагрузке достаточно сплэша.
 *
 * Разметка и стили живут инлайном в `resources/views/app.blade.php`,
 * чтобы первый кадр рисовался до загрузки CSS/JS.
 * Системный сплэш PWA (иконка + UPin из манифеста) рисует сам Chrome,
 * этот хук через blade-мост `__upinHideSplash` гасит наши оверлеи
 * после монтирования Vue. Фолбэк-таймеры внутри blade дублируют
 * скрытие на случай сбоя JS.
 *
 * @example
 * ```ts
 * import { hideSplash } from '@/composables/useSplash'
 *
 * hideSplash()
 * ```
 */

const LOADER_ID = 'pwa-boot'
const LEGACY_SPLASH_ID = 'pwa-splash'
const REMOVE_AFTER_MS = 500
const PAINT_DELAY_MS = 100

type BladeSplashBridge = {
  __upinHideSplash?: () => void
}

/**
 * Найти узел лоадера в DOM.
 *
 * @returns узел лоадера или null
 */
function loaderEl(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null
  }

  return document.getElementById(LOADER_ID)
}

/**
 * Убрать остаток legacy-сплэша, если он вдруг остался в DOM.
 */
function removeLegacySplash(): void {
  if (typeof document === 'undefined') {
    return
  }

  const legacy = document.getElementById(LEGACY_SPLASH_ID)

  if (legacy) {
    legacy.remove()
  }
}

/**
 * Плавно скрыть лоадер и убрать узел из DOM.
 */
export function hideSplash(): void {
  const bridge = window as unknown as BladeSplashBridge

  if (typeof bridge.__upinHideSplash === 'function') {
    const hide = bridge.__upinHideSplash

    window.requestAnimationFrame(() => {
      window.setTimeout(hide, PAINT_DELAY_MS)
    })

    return
  }

  const el = loaderEl()

  if (!el) {
    removeLegacySplash()

    return
  }

  el.classList.add('done')

  window.setTimeout(() => {
    el.remove()
    removeLegacySplash()
  }, REMOVE_AFTER_MS)
}

/**
 * Хук-обёртка над скрытием лоадера.
 *
 * @returns методы скрытия и проверки видимости лоадера
 */
export function useSplash() {
  /**
   * Проверить, виден ли лоадер прямо сейчас.
   *
   * @returns true, если узел лоадера ещё в DOM
   */
  function isVisible(): boolean {
    return loaderEl() !== null
  }

  return { hideSplash, isVisible }
}
