/**
 * Enter-to-send для чатов и комментариев.
 * Десктоп: Enter отправляет, Shift+Enter переносит строку.
 * Мобилка (touch): Enter всегда переносит строку, отправка только кнопкой.
 * @example
 * const { handleEnterToSend } = useEnterToSend()
 * // @keydown="handleEnterToSend($event, send)"
 */

/**
 * Проверяет, что устройство с физической клавиатурой.
 * @returns true для десктопа, false для touch-мобилок
 */
export function isDesktopEnter(): boolean {
  try {
    const fine = window.matchMedia('(pointer: fine)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const ua = navigator.userAgent || ''
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile|Telegram|WhatsApp/i.test(ua)
    return fine && !coarse && !mobileUa
  } catch {
    return false
  }
}

/**
 * Хук обработки Enter в многострочных полях.
 * @returns обработчик keydown для Textarea
 */
export function useEnterToSend() {
  /**
   * Обрабатывает нажатие Enter в поле ввода.
   * @param e клавиатурное событие
   * @param send колбэк отправки
   * @returns true если отправка выполнена и дефолт запрещён
   */
  function handleEnterToSend(e: KeyboardEvent, send: () => void): boolean {
    const isEnter = e.key === 'Enter'
    if (!isEnter) {
      return false
    }
    const withShift = e.shiftKey
    if (withShift) {
      return false
    }
    const withCtrl = e.ctrlKey || e.metaKey
    if (withCtrl) {
      return false
    }
    const isComposing = (e as any).isComposing
    if (isComposing) {
      return false
    }
    if (!isDesktopEnter()) {
      return false
    }
    e.preventDefault()
    send()
    return true
  }

  return { handleEnterToSend, isDesktopEnter }
}
