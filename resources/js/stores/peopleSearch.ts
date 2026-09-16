import { defineStore } from 'pinia'
import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'
import { districtsApi } from '@/services/districts.api'
import type { District } from '@/types/entities/District'

/**
 * Активный таб глобального поиска: люди или районы.
 */
export type GlobalSearchTab = 'people' | 'districts'

/**
 * Глобальный поиск по приложению для Ctrl+K.
 *
 * Держит состояние диалога, активный таб, строку запроса и результаты:
 * люди — через `/api/chat/users/search`, районы — через
 * `/api/districts?search=` (найти, вступить, знакомиться внутри).
 */
export const usePeopleSearchStore = defineStore('peopleSearch', () => {
  const open = ref(false)
  const activeTab = ref<GlobalSearchTab>('people')
  const query = ref('')
  const results = ref<any[]>([])
  const searching = ref(false)
  const districtQuery = ref('')
  const districtResults = ref<District[]>([])
  const districtSearching = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0
  let districtTimer: ReturnType<typeof setTimeout> | null = null
  let districtSeq = 0

  /**
   * Открыть глобальный диалог поиска.
   */
  function openDialog(): void {
    open.value = true
  }

  /**
   * Переключить таб поиска.
   * @param tab таб «people» или «districts»
   */
  function setActiveTab(tab: GlobalSearchTab): void {
    activeTab.value = tab
  }

  /**
   * Закрыть диалог и сбросить оба запроса.
   */
  function closeDialog(): void {
    open.value = false
    query.value = ''
    results.value = []
    searching.value = false
    districtQuery.value = ''
    districtResults.value = []
    districtSearching.value = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (districtTimer) {
      clearTimeout(districtTimer)
      districtTimer = null
    }
    seq += 1
    districtSeq += 1
  }

  /**
   * Установить запрос с дебаунсом 300мс.
   * @param value новая строка поиска
   */
  function setQuery(value: string): void {
    query.value = value

    const trimmed = value.trim()

    if (trimmed.length < 2) {
      results.value = []
      searching.value = false
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      return
    }

    if (timer) {
      clearTimeout(timer)
    }

    searching.value = true

    const current = ++seq

    timer = setTimeout(async () => {
      try {
        const data = await chatApi.search(trimmed)
        if (current !== seq) {
          return
        }
        results.value = (data as any[]) ?? []
      } catch {
        if (current !== seq) {
          return
        }
        results.value = []
      } finally {
        if (current === seq) {
          searching.value = false
        }
      }
    }, 300)
  }

  /**
   * Установить запрос поиска районов с дебаунсом 300мс.
   * @param value новая строка поиска
   */
  function setDistrictQuery(value: string): void {
    districtQuery.value = value

    const trimmed = value.trim()

    if (trimmed.length < 2) {
      districtResults.value = []
      districtSearching.value = false
      if (districtTimer) {
        clearTimeout(districtTimer)
        districtTimer = null
      }
      return
    }

    if (districtTimer) {
      clearTimeout(districtTimer)
    }

    districtSearching.value = true

    const current = ++districtSeq
    const term = trimmed

    districtTimer = setTimeout(async () => {
      try {
        const rows = await districtsApi.search(term)
        if (current !== districtSeq) {
          return
        }
        districtResults.value = rows ?? []
      } catch {
        if (current !== districtSeq) {
          return
        }
        districtResults.value = []
      } finally {
        if (current === districtSeq) {
          districtSearching.value = false
        }
      }
    }, 300)
  }

  /**
   * Обновить карточку района в выдаче (роль после вступления).
   * @param id id района
   * @param patch поля для обновления
   */
  function patchDistrict(id: number, patch: Partial<District>): void {
    const target = districtResults.value.find((row) => Number(row.id) === Number(id))
    if (target) {
      Object.assign(target, patch)
    }
  }

  return {
    open,
    activeTab,
    query,
    results,
    searching,
    districtQuery,
    districtResults,
    districtSearching,
    openDialog,
    closeDialog,
    setQuery,
    setActiveTab,
    setDistrictQuery,
    patchDistrict,
  }
})
