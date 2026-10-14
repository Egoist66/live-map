import { defineStore } from 'pinia'
import { reactive, computed } from 'vue'

/**
 * Состояние offline-кеша (IndexedDB) для мгновенного старта.
 *
 * Данные лежат в Dexie (`db/app.db.ts`), стор держит только лёгкий
 * статус: когда последний раз синкались, свежий ли кеш, жив ли sync.
 * Один объект `state` вместо россыпи ref (Правило №16 проекта).
 *
 * @example
 * const cache = useOfflineCacheStore()
 * cache.markSynced('conversations')
 * const fresh = cache.isFresh('conversations')
 */
export const useOfflineCacheStore = defineStore('offlineCache', () => {
  const state = reactive({
    /** Последний успешный синк по скоупу (ms epoch). */
    lastSync: {} as Record<string, number>,
    /** Идёт ли сейчас фоновая ревалидация скоупа. */
    syncing: {} as Record<string, boolean>,
    /** Кеш попал в квоту/ошибку записи. */
    quotaWarning: false,
  })

  /** TTL свежести кеша без сети: 10 минут. */
  const FRESH_TTL = 10 * 60 * 1000

  const quotaWarning = computed(() => state.quotaWarning)

  /**
   * Отметить успешный синк скоупа.
   *
   * @param scope conversations | messages:{id} | gallery:{ownerId} | profile:{ownerId}
   */
  function markSynced(scope: string): void {
    state.lastSync[scope] = Date.now()
    state.syncing[scope] = false
  }

  /**
   * Отметить начало фоновой ревалидации.
   *
   * @param scope скоуп кеша
   */
  function markSyncing(scope: string): void {
    state.syncing[scope] = true
  }

  /**
   * Снять флаг ревалидации без обновления времени (ошибка сети).
   *
   * @param scope скоуп кеша
   */
  function markSyncFailed(scope: string): void {
    state.syncing[scope] = false
  }

  /**
   * Свеж ли кеш скоупа (был синк в пределах TTL).
   *
   * @param scope скоуп кеша
   * @returns true когда можно рисовать кеш без лоадера
   */
  function isFresh(scope: string): boolean {
    const at = state.lastSync[scope] ?? 0
    return Date.now() - at < FRESH_TTL
  }

  /**
   * Идёт ли ревалидация скоупа прямо сейчас.
   *
   * @param scope скоуп кеша
   */
  function isSyncing(scope: string): boolean {
    return !!state.syncing[scope]
  }

  /**
   * Зафиксировать проблему квоты (перестаём писать бинарники,
   * JSON-кеш продолжаем — он крошечный).
   */
  function noteQuotaWarning(): void {
    state.quotaWarning = true
  }

  /**
   * Сбросить статус (смена аккаунта/логаут).
   */
  function reset(): void {
    const keys = Object.keys(state.lastSync)
    for (const key of keys) {
      delete state.lastSync[key]
    }
    const syncingKeys = Object.keys(state.syncing)
    for (const key of syncingKeys) {
      delete state.syncing[key]
    }
    state.quotaWarning = false
  }

  return {
    state,
    quotaWarning,
    markSynced,
    markSyncing,
    markSyncFailed,
    isFresh,
    isSyncing,
    noteQuotaWarning,
    reset,
  }
})
