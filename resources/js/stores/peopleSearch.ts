import { defineStore } from 'pinia'
import { ref } from 'vue'
import { chatApi } from '@/services/chat.api'
import { districtsApi } from '@/services/districts.api'
import { businessApi } from '@/services/business.api'
import type { District } from '@/types/entities/District'
import type { BusinessMapItem } from '@/types/entities/Business'

/**
 * Активный таб глобального поиска: люди, районы или организации.
 */
export type GlobalSearchTab = 'people' | 'districts' | 'organizations'

/**
 * Нормализовать ответ поиска людей к массиву.
 *
 * @param data ответ API (массив или пагинация)
 */
function normalizePeople(data: unknown): any[] {
  if (Array.isArray(data)) return data
  const rows = (data as { data?: unknown })?.data
  return Array.isArray(rows) ? rows : []
}

/**
 * Глобальный поиск по приложению для Ctrl+K с infinite scroll.
 *
 * Держит состояние диалога, активный таб, строку запроса и результаты:
 * люди — через `/api/chat/users/search?page=`, районы — через
 * `/api/districts?search=&page=`, организации — через
 * `/api/businesses/search?q=` (название + бренд). Догрузка —
 * `loadMorePeople()` / `loadMoreDistricts()` по sentinel внизу списка.
 */
export const usePeopleSearchStore = defineStore('peopleSearch', () => {
  const open = ref(false)
  const activeTab = ref<GlobalSearchTab>('people')
  const query = ref('')
  const results = ref<any[]>([])
  const searching = ref(false)
  const loadingMorePeople = ref(false)
  const peopleHasMore = ref(false)
  const peoplePage = ref(1)
  const peopleLastPage = ref(1)
  const districtQuery = ref('')
  const districtResults = ref<District[]>([])
  const districtSearching = ref(false)
  const loadingMoreDistricts = ref(false)
  const districtsHasMore = ref(false)
  const districtPage = ref(1)
  const districtLastPage = ref(1)
  /** Первые существующие районы для пустого таба «Районы» (максимум 3). */
  const districtSuggestions = ref<District[]>([])
  const districtSuggestionsLoading = ref(false)
  /** Поиск организаций по названию и бренду (таб «Организации»). */
  const orgQuery = ref('')
  const orgResults = ref<BusinessMapItem[]>([])
  const orgSearching = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null
  let seq = 0
  let districtTimer: ReturnType<typeof setTimeout> | null = null
  let districtSeq = 0
  let suggestionsLoaded = false
  let orgTimer: ReturnType<typeof setTimeout> | null = null
  let orgSeq = 0

  /**
   * Открыть глобальный диалог поиска.
   */
  function openDialog(): void {
    open.value = true
  }

  /**
   * Переключить таб поиска.
   * @param tab таб «people», «districts» или «organizations»
   */
  function setActiveTab(tab: GlobalSearchTab): void {
    activeTab.value = tab
  }

  /**
   * Закрыть диалог и сбросить все запросы.
   */
  function closeDialog(): void {
    open.value = false
    query.value = ''
    results.value = []
    searching.value = false
    peopleHasMore.value = false
    peoplePage.value = 1
    districtQuery.value = ''
    districtResults.value = []
    districtSearching.value = false
    districtsHasMore.value = false
    districtPage.value = 1
    orgQuery.value = ''
    orgResults.value = []
    orgSearching.value = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (districtTimer) {
      clearTimeout(districtTimer)
      districtTimer = null
    }
    if (orgTimer) {
      clearTimeout(orgTimer)
      orgTimer = null
    }
    seq += 1
    districtSeq += 1
    orgSeq += 1
  }

  /**
   * Установить запрос поиска организаций с дебаунсом 300мс.
   *
   * Ищем по названию и бренду: юрназвание часто канцелярское,
   * а клиенты помнят бренд.
   *
   * @param value новая строка поиска
   */
  function setOrgQuery(value: string): void {
    orgQuery.value = value

    const trimmed = value.trim()

    if (trimmed.length < 2) {
      orgResults.value = []
      orgSearching.value = false
      if (orgTimer) {
        clearTimeout(orgTimer)
        orgTimer = null
      }
      return
    }

    if (orgTimer) {
      clearTimeout(orgTimer)
    }

    orgSearching.value = true

    const current = ++orgSeq
    const term = trimmed

    orgTimer = setTimeout(async () => {
      try {
        const rows = await businessApi.searchOrganizations(term)
        if (current !== orgSeq) {
          return
        }
        orgResults.value = rows ?? []
      } catch {
        if (current !== orgSeq) {
          return
        }
        orgResults.value = []
      } finally {
        if (current === orgSeq) {
          orgSearching.value = false
        }
      }
    }, 300)
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
      peopleHasMore.value = false
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
        const data = await chatApi.search(trimmed, 1)
        if (current !== seq) {
          return
        }
        results.value = normalizePeople(data)
        peoplePage.value = Number((data as { current_page?: number })?.current_page ?? 1)
        peopleLastPage.value = Number((data as { last_page?: number })?.last_page ?? 1)
        peopleHasMore.value = !!(data as { has_more?: boolean })?.has_more
      } catch {
        if (current !== seq) {
          return
        }
        results.value = []
        peopleHasMore.value = false
      } finally {
        if (current === seq) {
          searching.value = false
        }
      }
    }, 300)
  }

  /**
   * Догрузить следующую страницу людей для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMorePeople(): Promise<boolean> {
    const trimmed = query.value.trim()
    if (trimmed.length < 2 || searching.value || loadingMorePeople.value || !peopleHasMore.value) return false
    loadingMorePeople.value = true
    try {
      const next = peoplePage.value + 1
      const data = await chatApi.search(trimmed, next)
      const rows = normalizePeople(data)
      const known = new Set(results.value.map((u) => Number(u?.id)))
      const fresh = rows.filter((u) => !known.has(Number(u?.id)))
      results.value = [...results.value, ...fresh]
      peoplePage.value = Number((data as { current_page?: number })?.current_page ?? next)
      peopleLastPage.value = Number((data as { last_page?: number })?.last_page ?? peoplePage.value)
      peopleHasMore.value = !!(data as { has_more?: boolean })?.has_more && rows.length > 0
      return fresh.length > 0
    } catch {
      return false
    } finally {
      loadingMorePeople.value = false
    }
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
      districtsHasMore.value = false
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
        const res = await districtsApi.search(term, 1)
        if (current !== districtSeq) {
          return
        }
        districtResults.value = res.data ?? []
        districtPage.value = res.current_page ?? 1
        districtLastPage.value = res.last_page ?? 1
        districtsHasMore.value = !!res.has_more
      } catch {
        if (current !== districtSeq) {
          return
        }
        districtResults.value = []
        districtsHasMore.value = false
      } finally {
        if (current === districtSeq) {
          districtSearching.value = false
        }
      }
    }, 300)
  }

  /**
   * Догрузить следующую страницу районов для infinite scroll.
   *
   * @returns false когда страниц больше нет
   */
  async function loadMoreDistricts(): Promise<boolean> {
    const trimmed = districtQuery.value.trim()
    if (trimmed.length < 2 || districtSearching.value || loadingMoreDistricts.value || !districtsHasMore.value) return false
    loadingMoreDistricts.value = true
    try {
      const next = districtPage.value + 1
      const res = await districtsApi.search(trimmed, next)
      const rows = res.data ?? []
      const known = new Set(districtResults.value.map((r) => Number(r.id)))
      const fresh = rows.filter((r) => !known.has(Number(r.id)))
      districtResults.value = [...districtResults.value, ...fresh]
      districtPage.value = res.current_page ?? next
      districtLastPage.value = res.last_page ?? districtPage.value
      districtsHasMore.value = !!res.has_more && rows.length > 0
      return fresh.length > 0
    } catch {
      return false
    } finally {
      loadingMoreDistricts.value = false
    }
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
    const suggested = districtSuggestions.value.find((row) => Number(row.id) === Number(id))
    if (suggested) {
      Object.assign(suggested, patch)
    }
  }

  /**
   * Подтянуть первые существующие районы для пустого таба (максимум 3).
   * Грузится один раз за сессию, повторные вызовы — из кэша.
   */
  async function ensureDistrictSuggestions(): Promise<void> {
    if (suggestionsLoaded || districtSuggestionsLoading.value) {
      return
    }
    districtSuggestionsLoading.value = true
    try {
      const rows = await districtsApi.list()
      districtSuggestions.value = (rows ?? []).slice(0, 3)
      suggestionsLoaded = true
    } catch {
      districtSuggestions.value = []
    } finally {
      districtSuggestionsLoading.value = false
    }
  }

  return {
    open,
    activeTab,
    query,
    results,
    searching,
    loadingMorePeople,
    peopleHasMore,
    districtQuery,
    districtResults,
    districtSearching,
    loadingMoreDistricts,
    districtsHasMore,
    districtSuggestions,
    districtSuggestionsLoading,
    orgQuery,
    orgResults,
    orgSearching,
    openDialog,
    closeDialog,
    setQuery,
    setActiveTab,
    setDistrictQuery,
    setOrgQuery,
    loadMorePeople,
    loadMoreDistricts,
    patchDistrict,
    ensureDistrictSuggestions,
  }
})
