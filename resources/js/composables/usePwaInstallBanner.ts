import { computed, onMounted, ref } from 'vue'
import { usePwa } from '@/composables/usePwa'
import { useBuildVersion } from '@/composables/useBuildVersion'
import { usePwaInstallGuide } from '@/composables/usePwaInstallGuide'

/** Через сколько дней после закрытия снова предложить установку. */
export const PWA_INSTALL_SNOOZE_DAYS = 14

const DISMISS_KEY = 'pwa-install-dismissed'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Прочитать время последнего закрытия баннера.
 *
 * @returns timestamp закрытия или 0 (включая легаси «1» — предлагаем снова)
 */
function readDismissedAt(): number {
  const raw = readStored(DISMISS_KEY)
  const parsed = Number(raw)
  if (!raw || Number.isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}

/**
 * Прочитать значение из localStorage/sessionStorage (максимум из обоих).
 *
 * @param key ключ
 * @returns значение или null
 */
function readStored(key: string): string | null {
  let fromLocal: string | null = null
  let fromSession: string | null = null
  try {
    fromLocal = localStorage.getItem(key)
  } catch {}
  try {
    fromSession = sessionStorage.getItem(key)
  } catch {}
  if (fromLocal !== null && fromSession !== null) {
    return String(Math.max(Number(fromLocal) || 0, Number(fromSession) || 0))
  }
  return fromLocal ?? fromSession
}

/**
 * Баннер «Установить ULove»: предлагается всегда, пока не standalone.
 *
 * Виден всем гостям и пользователям без установленного приложения:
 * либо системный промпт, либо инструкция под платформу. Закрытие —
 * это snooze на `PWA_INSTALL_SNOOZE_DAYS`, а не вечный отказ: предложение
 * возвращается. Молчит, пока висит обновление (деплой): приоритет
 * у баннера обновления, иначе два баннера на одной геометрии.
 * Стартует скрытым, чтобы перемонтирование на навигации не давало вспышки.
 *
 * @returns состояние баннера и действия
 * @example
 * const { visible, install, dismiss } = usePwaInstallBanner()
 */
export function usePwaInstallBanner() {
  const { canInstall, standalone, promptInstall, needUpdate } = usePwa()
  const build = useBuildVersion()
  const guide = usePwaInstallGuide()
  // Старт скрытым (snooze): точная метка из стореджа подтягивается в onMounted.
  // Наоборот (видимый → скрытый) даёт вспышку на каждой навигации: лейауты
  // per-page, баннер перемонтируется, первый paint рисует его, а onMounted
  // тут же гасит через leave-transition — «появляется и исчезает».
  // Скрытый старт и для SSR детерминирован: сервер и гидрация совпадают.
  const dismissedAt = ref(Date.now())

  onMounted(() => {
    dismissedAt.value = readDismissedAt()
  })

  /** Баннер закрыт прямо сейчас (действует snooze после «Позже»). */
  const dismissed = computed(() => Date.now() - dismissedAt.value < PWA_INSTALL_SNOOZE_DAYS * DAY_MS)

  /** Висит необработанное обновление: приоритет у баннера обновления. */
  const updatePending = computed(() => needUpdate.value || build.buildUpdateAvailable.value)

  /** Показывать всем без установленного приложения, кроме snooze. */
  const visible = computed(() => {
    if (standalone.value || dismissed.value) {
      return false
    }
    if (updatePending.value) {
      return false
    }
    return true
  })

  /**
   * Отложить предложение: snooze, баннер вернётся через `PWA_INSTALL_SNOOZE_DAYS`.
   */
  function dismiss(): void {
    dismissedAt.value = Date.now()
    try {
      localStorage.setItem(DISMISS_KEY, String(dismissedAt.value))
    } catch {}
  }

  /** Установить: сразу системный промпт, без подсказок; инструкция — только если промпта нет. */
  async function install(): Promise<void> {
    if (!canInstall.value) {
      guide.openGuide()
      return
    }
    const outcome = await promptInstall()
    if (outcome !== 'unavailable') {
      dismiss()
    }
  }

  return { canInstall, standalone, dismissed, visible, updatePending, hint: guide.hint, install, dismiss }
}
