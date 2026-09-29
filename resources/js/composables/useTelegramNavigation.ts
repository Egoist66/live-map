import { router } from '@inertiajs/vue3'
import { isTelegramWebView, webAppSupports } from '@/composables/useTelegram'

let initialized = false
let backHandler: (() => void) | null = null

/**
 * Синхронизировать Telegram BackButton с историей браузера.
 *
 * Правила:
 * - на главной (/, /swipes) кнопку прячем — там некуда «назад»;
 * - на остальных экранах показываем, клик = history.back()
 *   (WebView телеграма сам держит стек, дублировать роутер не надо);
 * - вне Telegram — no-op.
 *
 * Вызывать один раз после initTelegram (например, из AppLayout).
 * Переподписка на каждую навигацию — через router.on('navigate').
 *
 * @example
 * ```ts
 * const { initTelegramNavigation } = useTelegramNavigation()
 * await initTelegram()
 * initTelegramNavigation()
 * ```
 *
 * @returns инициализатор синхронизации
 */
export function useTelegramNavigation() {
  /**
   * Спрятать или показать BackButton по текущему пути.
   */
  function syncBackButton(): void {
    const webApp = window.Telegram?.WebApp

    if (!webApp || !isTelegramWebView()) {
      return
    }

    // BackButton — Bot API 6.1: на 6.0 любой вызов спамит варнингом.
    if (!webAppSupports(webApp, '6.1')) {
      return
    }

    const path = window.location.pathname
    const isRoot = path === '/' || path === '/swipes' || path === '/map'

    try {
      if (isRoot || window.history.length <= 1) {
        webApp.BackButton.hide()
      } else {
        webApp.BackButton.show()
      }
    } catch {
      // No-op.
    }
  }

  /**
   * Подписаться на BackButton и навигации Inertia.
   */
  function initTelegramNavigation(): void {
    if (initialized || !isTelegramWebView()) {
      return
    }
    initialized = true

    const webApp = window.Telegram?.WebApp

    if (!webApp || !webAppSupports(webApp, '6.1')) {
      return
    }

    backHandler = () => {
      if (window.history.length > 1) {
        window.history.back()
      } else {
        router.visit('/swipes')
      }
    }

    try {
      webApp.BackButton.onClick(backHandler)
    } catch {
      // No-op.
    }

    syncBackButton()

    try {
      router.on('navigate', () => syncBackButton())
    } catch {
      // No-op: старые версии Inertia без navigate-события.
    }
  }

  /**
   * Отписаться от BackButton (для тестов / HMR).
   */
  function destroyTelegramNavigation(): void {
    const webApp = window.Telegram?.WebApp

    if (webApp && backHandler) {
      try {
        webApp.BackButton.offClick(backHandler)
      } catch {
        // No-op.
      }
    }

    backHandler = null
    initialized = false
  }

  return { initTelegramNavigation, destroyTelegramNavigation, syncBackButton }
}
