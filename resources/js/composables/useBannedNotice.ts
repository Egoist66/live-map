import { onMounted, ref, watch } from 'vue'

/**
 * Модалка «Доступ запрещён» прямо на форме входа.
 *
 * Триггеры: ?banned=1 в URL (туда режет мидлвар забаненных вместо
 * страницы «Сюда нельзя»), текст бана в ошибке формы или в ошибке
 * Telegram-автовхода. Никуда не редиректит — только модалка.
 * Компонент лишь показывает Dialog и зовёт close.
 *
 * @param getTexts реактивные тексты для слежки (ошибки формы, TG-статус)
 * @returns флаг модалки и закрытие
 * @example const banned = useBannedNotice(() => [errors.email, tgError])
 */
export function useBannedNotice(getTexts: () => Array<unknown>) {
  const visible = ref(false)

  /**
   * Редирект мидлвара для забаненных сессий.
   */
  function hasMarker(): boolean {
    try {
      if (typeof window === 'undefined') {
        return false
      }

      return new URLSearchParams(window.location.search).get('banned') === '1'
    } catch {
      return false
    }
  }

  function isBanText(value: unknown): boolean {
    return typeof value === 'string' && /заблокирован/i.test(value)
  }

  function sync(): void {
    if (hasMarker()) {
      visible.value = true

      return
    }

    try {
      if (getTexts().some(isBanText)) {
        visible.value = true
      }
    } catch {
      // No-op: тексты недоступны — модалки нет.
    }
  }

  onMounted(sync)

  try {
    watch(getTexts, sync)
  } catch {
    // No-op: без реактивности останется стартовое состояние.
  }

  function close(): void {
    visible.value = false
  }

  return { bannedVisible: visible, closeBanned: close }
}
