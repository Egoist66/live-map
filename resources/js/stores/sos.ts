import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { acceptSos, closeSos, declineSos, fetchMySos, type SosCallState, type SosLimits } from '@/services/sos.api'

/**
 * Стор SOS-режима: активный вызов, лимиты месяца, принятие/закрытие.
 */
export const useSosStore = defineStore('sos', () => {
  const active = ref<SosCallState | null>(null)
  const limits = ref<SosLimits>({ used: 0, limit: 1, left: 1, is_pro: false })
  const loading = ref(false)
  const acting = ref(false)
  const error = ref<string | null>(null)

  const isSosMode = computed(() => active.value !== null)
  const isCreator = computed(() => !!active.value?.is_creator)
  const conversationId = computed(() => active.value?.conversation_id ?? null)

  /**
   * Загрузить активный SOS и лимиты.
   */
  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const data = await fetchMySos()
      active.value = data.sos
      limits.value = data.limits
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось загрузить SOS'
    } finally {
      loading.value = false
    }
  }

  /**
   * Принять SOS-пин и получить чат.
   * @param pinId id SOS-пина
   * @returns conversation_id чата или null
   */
  async function accept(pinId: number): Promise<number | null> {
    acting.value = true
    error.value = null
    try {
      const { sos } = await acceptSos(pinId)
      active.value = sos
      await load()
      return sos.conversation_id
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось принять SOS'
      throw e
    } finally {
      acting.value = false
    }
  }

  /**
   * Отклонить SOS-пин.
   * @param pinId id SOS-пина
   */
  async function decline(pinId: number): Promise<void> {
    acting.value = true
    error.value = null
    try {
      await declineSos(pinId)
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось отклонить SOS'
      throw e
    } finally {
      acting.value = false
    }
  }

  /**
   * Завершить свой SOS (пин удаляется, чат остаётся).
   * @param pinId id SOS-пина
   */
  async function close(pinId: number): Promise<void> {
    acting.value = true
    error.value = null
    try {
      await closeSos(pinId)
      active.value = null
      await load()
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Не удалось завершить SOS'
      throw e
    } finally {
      acting.value = false
    }
  }

  return { active, limits, loading, acting, error, isSosMode, isCreator, conversationId, load, accept, decline, close }
})
