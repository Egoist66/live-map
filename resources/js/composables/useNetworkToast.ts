import { readonly, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useNetworkStatus } from '@/composables/useNetworkStatus'

/**
 * Сколько миллисекунд виден тост «Соединение восстановлено».
 */
const RESTORED_VISIBLE_MS = 4000

/**
 * Виден ли сейчас тост восстановления (общий для всех вызовов хука).
 */
const showRestored = ref(false)

let watchBound = false
let restoredTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Остановить и забыть таймер автоскрытия тоста восстановления.
 */
function clearRestoredTimer(): void {
  if (restoredTimer === null) {
    return
  }

  clearTimeout(restoredTimer)
  restoredTimer = null
}

/**
 * Показать тост восстановления и спрятать его через паузу.
 */
function scheduleRestoredHide(): void {
  clearRestoredTimer()

  restoredTimer = setTimeout(() => {
    restoredTimer = null
    showRestored.value = false
  }, RESTORED_VISIBLE_MS)
}

/**
 * Один раз подписаться на переходы сети для тоста восстановления.
 *
 * Тост показывается только на реальном переходе «офлайн → онлайн»:
 * при загрузке страницы в онлайне вотчер не срабатывает (без immediate),
 * поэтому ложного «восстановлено» на входе нет.
 *
 * @param isOfflineRef реактивный флаг офлайна из useNetworkStatus
 */
function bindRestoreWatch(isOfflineRef: Ref<boolean>): void {
  if (watchBound) {
    return
  }

  watchBound = true

  watch(isOfflineRef, (offlineNow, offlineBefore) => {
    const justRestored = offlineNow === false && offlineBefore === true

    if (justRestored) {
      showRestored.value = true
      scheduleRestoredHide()

      return
    }

    const justLost = offlineNow === true && offlineBefore === false

    if (justLost) {
      clearRestoredTimer()
      showRestored.value = false
    }
  })
}

/**
 * Состояние тостов сети для компонента `NetworkStatusToast`.
 *
 * Офлайн-тост виден, пока `isOffline` (залипает до появления сети).
 * Тост «восстановлено» всплывает на переходе в онлайн и гаснет сам
 * через 4 секунды либо по крестику. Компонент только отображает —
 * вся логика тайминга здесь.
 *
 * @returns isOffline флаг, showRestored флаг, dismissRestored гаситель
 * @example
 * ```vue
 * <script setup lang="ts">
 * const { isOffline, showRestored, dismissRestored } = useNetworkToast()
 * </script>
 * ```
 */
export function useNetworkToast() {
  const { isOffline } = useNetworkStatus()

  bindRestoreWatch(isOffline)

  /**
   * Скрыть тост восстановления досрочно (крестик).
   */
  function dismissRestored(): void {
    clearRestoredTimer()
    showRestored.value = false
  }

  return {
    isOffline,
    showRestored: readonly(showRestored),
    dismissRestored,
  }
}
