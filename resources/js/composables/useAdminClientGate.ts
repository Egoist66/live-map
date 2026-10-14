import { computed } from 'vue'
import { isTelegramWebView, useTelegram } from '@/composables/useTelegram'
import { isNativeWebView, useNativeClient } from '@/composables/useNativeClient'

/**
 * Чистый предикат «клиенту запрещена админка» (без Vue-контекста).
 *
 * Telegram Mini App и мобильная WebView (upin-mobile) обслуживаются
 * только браузером для модерации: десктоп или мобильный браузер.
 * Используется в местах без setup-контекста (openAdminPanel,
 * goReports, фоновые fetch счётчиков).
 *
 * @returns true внутри Telegram или нативной WebView
 * @example
 * if (isAdminBlockedClient()) return
 */
export function isAdminBlockedClient(): boolean {
  try {
    return isTelegramWebView() || isNativeWebView()
  } catch {
    return false
  }
}

/**
 * Реактивный гейт админки для нативных клиентов.
 *
 * Те же Telegram/WebView, но реактивно (рефы мостов): для `v-if`
 * пунктов меню, кнопок и табов. Серверный флаг `client.isNative`
 * уже учтён внутри `useNativeClient().isNative`.
 *
 * @returns флаг блокировки админки для текущего клиента
 * @example
 * const { isAdminBlocked } = useAdminClientGate()
 * // <Button v-if="staff && !isAdminBlocked" ... />
 */
export function useAdminClientGate() {
  const { isTelegram } = useTelegram()
  const { isNative } = useNativeClient()

  const isAdminBlocked = computed(() => isTelegram.value || isNative.value)

  return { isAdminBlocked }
}
