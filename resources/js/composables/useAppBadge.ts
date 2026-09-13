import { watch } from 'vue'
import { Badge } from '@capawesome/capacitor-badge'
import { useBadgeStore } from '@/stores/badges'
import { usePlatform } from '@/composables/usePlatform'

let inited = false
let supported: boolean | null = null

/**
 * Счётчик непрочитанного на иконке нативного приложения.
 *
 * Зеркалит `useBadgeStore().total` в системный бейдж через
 * `@capawesome/capacitor-badge`. На вебе — no-op.
 * Вызывать `initAppBadge()` один раз из layout (useAppLayout),
 * `clearAppBadge()` — при выходе из аккаунта.
 *
 * @returns init/sync/clear для бейджа иконки
 * @example
 * const { initAppBadge, clearAppBadge } = useAppBadge()
 * initAppBadge()
 */
export function useAppBadge() {
  const { isNative } = usePlatform()

  /**
   * Проверяет поддержку бейджа на устройстве (один раз, с кэшем).
   *
   * @returns true если бейдж можно ставить
   */
  async function isBadgeSupported(): Promise<boolean> {
    if (!isNative) {
      return false
    }
    if (supported !== null) {
      return supported
    }
    try {
      const result = await Badge.isSupported()
      supported = result.isSupported
    } catch {
      supported = false
    }
    return supported
  }

  /**
   * Ставит счётчик на иконку (0 — снимает).
   *
   * @param count число непрочитанных
   * @returns void
   */
  async function syncAppBadge(count: number): Promise<void> {
    const allowed = await isBadgeSupported()
    if (!allowed) {
      return
    }
    const safe = Math.max(0, Math.floor(Number(count) || 0))
    try {
      if (safe === 0) {
        await Badge.clear()
        return
      }
      await Badge.set({ count: safe })
    } catch {}
  }

  /**
   * Снимает счётчик (выход, смена аккаунта).
   *
   * @returns void
   */
  async function clearAppBadge(): Promise<void> {
    const allowed = await isBadgeSupported()
    if (!allowed) {
      return
    }
    try {
      await Badge.clear()
    } catch {}
  }

  /**
   * Подписывает бейдж на стор счётчиков (один раз).
   *
   * @returns void
   */
  function initAppBadge(): void {
    if (inited || !isNative) {
      return
    }
    inited = true
    try {
      const store = useBadgeStore()
      watch(
        () => store.total,
        (total) => {
          void syncAppBadge(total)
        },
      )
      void syncAppBadge(store.total)
    } catch {}
  }

  return { initAppBadge, syncAppBadge, clearAppBadge }
}
