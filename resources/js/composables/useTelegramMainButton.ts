import { ref } from 'vue'
import { isTelegramWebView, webAppSupports } from '@/composables/useTelegram'

const isVisible = ref(false)
const label = ref('')
const isLoading = ref(false)
let clickHandler: (() => void) | null = null
let themeHandler: (() => void) | null = null

/**
 * Достать нативный MainButton, если клиент его поддерживает.
 *
 * @returns MainButton или null вне Telegram / в старых клиентах
 */
function getMainButton(): import('@/types/telegram').TelegramMainButton | null {
  if (typeof window === 'undefined' || !isTelegramWebView()) {
    return null
  }

  const button = window.Telegram?.WebApp?.MainButton ?? null

  if (!button || typeof button.show !== 'function') {
    return null
  }

  return button
}

/**
 * Покрасить MainButton под текущую палитру Telegram.
 *
 * setParams — Bot API 6.1: на 6.0 вызов лишь спамит варнингом,
 * поэтому версию проверяем заранее. Сама кнопка (setText/show)
 * доступна уже с 6.0 — она не гейтится.
 *
 * Вызывать после show/setText и на событие themeChanged,
 * иначе кнопка остаётся дефолтной синей в кастомных темах.
 */
function syncMainButtonTheme(): void {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
  const button = getMainButton()
  const theme = webApp?.themeParams

  if (!button || !theme || !webApp || !webAppSupports(webApp, '6.1')) {
    return
  }

  const color = theme.button_color
  const textColor = theme.button_text_color

  if (!color && !textColor) {
    return
  }

  try {
    button.setParams({
      ...(color ? { color } : {}),
      ...(textColor ? { text_color: textColor } : {}),
    })
  } catch {
    // No-op: старые клиенты без setParams.
  }
}

/**
 * Нативная нижняя кнопка Telegram (MainButton).
 *
 * Правило Mini App: главное действие экрана — нативный MainButton,
 * а не самодельная кнопка: он позиционируется самим клиентом,
 * красится темой и показывает прогресс. Самодельные кнопки
 * оставляем только для вторичных действий внутри контента.
 *
 * Один хук — одна ответственность (Правило №1): видимость, текст,
 * прогресс и клик главной кнопки. BackButton — в useTelegramNavigation.
 *
 * @example
 * ```ts
 * const { showMainButton, hideMainButton } = useTelegramMainButton()
 * showMainButton('Продолжить', () => submit())
 * // ... после успеха:
 * hideMainButton()
 * ```
 *
 * @returns состояние кнопки и методы управления
 */
export function useTelegramMainButton() {
  /**
   * Показать MainButton с текстом и обработчиком клика.
   *
   * Вне Telegram — no-op (форма обязана сабмититься своей кнопкой).
   * Предыдущий обработчик снимается, двойных подписок нет.
   *
   * @param text текст кнопки
   * @param onClick обработчик нажатия
   */
  function showMainButton(text: string, onClick: () => void): void {
    const button = getMainButton()

    if (!button) {
      return
    }

    hideMainButton()

    label.value = text
    clickHandler = onClick

    try {
      button.setText(text)
      button.onClick(clickHandler)
      button.show()
      syncMainButtonTheme()
    } catch {
      // No-op: кнопка необязательна для работы экрана.
    }

    isVisible.value = true

    try {
      const webApp = window.Telegram?.WebApp

      if (webApp && !themeHandler) {
        themeHandler = () => syncMainButtonTheme()
        webApp.onEvent('themeChanged', themeHandler)
      }
    } catch {
      // No-op.
    }
  }

  /**
   * Скрыть MainButton и снять обработчик клика.
   */
  function hideMainButton(): void {
    const button = getMainButton()

    if (clickHandler && button) {
      try {
        button.offClick(clickHandler)
      } catch {
        // No-op.
      }
    }

    clickHandler = null
    isVisible.value = false
    isLoading.value = false
    label.value = ''

    if (!button) {
      return
    }

    const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined
    const supportsProgress = webApp ? webAppSupports(webApp, '6.1') : false

    if (supportsProgress) {
      try {
        button.hideProgress()
      } catch {
        // No-op.
      }
    }

    try {
      button.hide()
    } catch {
      // No-op.
    }
  }

  /**
   * Включить/выключить спиннер загрузки на кнопке.
   *
   * showProgress — Bot API 6.1: на 6.0 вызов лишь спамит варнингом.
   *
   * @param loading true — показать прогресс
   */
  function setMainButtonLoading(loading: boolean): void {
    const button = getMainButton()
    const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined

    if (!button || !webApp || !webAppSupports(webApp, '6.1')) {
      return
    }

    isLoading.value = loading

    try {
      if (loading) {
        button.showProgress(false)
      } else {
        button.hideProgress()
      }
    } catch {
      // No-op.
    }
  }

  /**
   * Сделать кнопку (не)активной без скрытия.
   *
   * enable/disable — Bot API 6.1: на 6.0 вызов лишь спамит варнингом.
   *
   * @param active true — кнопка нажимаема
   */
  function setMainButtonActive(active: boolean): void {
    const button = getMainButton()
    const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined

    if (!button || !webApp || !webAppSupports(webApp, '6.1')) {
      return
    }

    try {
      if (active) {
        button.enable()
      } else {
        button.disable()
      }
    } catch {
      // No-op.
    }
  }

  return { isVisible, label, isLoading, showMainButton, hideMainButton, setMainButtonLoading, setMainButtonActive }
}
