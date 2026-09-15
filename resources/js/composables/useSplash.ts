/**
 * Стартовый splash-экран PWA.
 *
 * Разметка и стили заставки живут инлайном в `resources/views/app.blade.php`,
 * чтобы первый кадр рисовался до загрузки CSS/JS (cold start PWA).
 * Этот хук только гасит заставку после монтирования Vue.
 * Фолбэк-таймеры внутри blade дублируют скрытие на случай сбоя JS.
 *
 * @example
 * ```ts
 * import { hideSplash } from '@/composables/useSplash'
 *
 * hideSplash()
 * ```
 */

const SPLASH_ID = 'pwa-splash'
const REMOVE_AFTER_MS = 750
const PAINT_DELAY_MS = 350

type BladeSplashBridge = {
  __upinHideSplash?: () => void
}

function splashEl(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null
  }

  return document.getElementById(SPLASH_ID)
}

/**
 * Плавно скрыть splash и убрать узел из DOM.
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

  const el = splashEl()

  if (!el) {
    return
  }

  el.classList.add('done')
  window.setTimeout(() => el.remove(), REMOVE_AFTER_MS)
}

/**
 * Хук-обёртка над скрытием splash-экрана.
 *
 * @returns методы скрытия и проверки видимости заставки
 */
export function useSplash() {
  /**
   * Проверить, видна ли заставка прямо сейчас.
   *
   * @returns true, если узел splash ещё в DOM
   */
  function isVisible(): boolean {
    return splashEl() !== null
  }

  return { hideSplash, isVisible }
}
