import { computed } from 'vue'
import { useToast } from 'primevue/usetoast'
import { usePipeStore } from '@/stores/pipe'

/**
 * Ручное обновление данных Pipes для кнопки-стрелки в шапке.
 *
 * Дёргает стор `refreshAll()` (лента + открытый тред с ответами)
 * и показывает понятный тост. Фоновая ревалидация в сторе при этом
 * не отключается: кеш остаётся cache-first, а сеть всегда
 * подтягивает актуальное состояние.
 *
 * @example
 * const { refreshing, refresh } = usePipeRefresh()
 * // <Button icon="pi pi-refresh" :loading="refreshing" @click="refresh" />
 */
export function usePipeRefresh() {
  const store = usePipeStore()
  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null
    }
  })()

  /** Идёт ли ручное обновление (крутится иконка, дубли блокируются). */
  const refreshing = computed(() => store.refreshing)

  /**
   * Обновить ленту и открытый тред вручную.
   *
   * @returns true, если данные обновились
   */
  async function refresh(): Promise<boolean> {
    if (refreshing.value) return false

    const updated = await store.refreshAll()

    if (toast) {
      if (updated) {
        toast.add({
          severity: 'success',
          summary: 'Обновлено',
          detail: 'Показаны актуальные pipes',
          life: 1800,
        })
      } else {
        toast.add({
          severity: 'error',
          summary: 'Не удалось обновить',
          detail: 'Проверьте соединение и попробуйте ещё раз',
          life: 2600,
        })
      }
    }

    return updated
  }

  return { refreshing, refresh }
}
