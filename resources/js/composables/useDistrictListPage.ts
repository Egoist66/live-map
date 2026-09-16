import { computed, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { districtsApi } from '@/services/districts.api'
import type { District } from '@/types/entities/District'

/**
 * Витрина районов: свои сообщества + свежие рядом.
 *
 * Список грузится API без карты (последние 200), поиск — локально
 * по названию: страница лёгкая и одинаково живёт на мобилке.
 *
 * @param canCreate разрешено ли создание тарифом (SSR)
 * @param limitText строка лимита тарифа (SSR)
 * @example
 * const list = useDistrictListPage(props.canCreate, props.limitText)
 * await list.init()
 */
export function useDistrictListPage(canCreate: boolean, limitText: string) {
  /** Свои сообщества (владелец/житель). */
  const mine = ref<District[]>([])
  /** Витрина: свежие сообщества. */
  const all = ref<District[]>([])
  const loadingMine = ref(false)
  const loadingAll = ref(false)
  /** Поиск по названию. */
  const query = ref('')

  const filteredAll = computed(() => {
    const clean = query.value.trim().toLowerCase()
    if (!clean) {
      return all.value
    }
    return all.value.filter((district) => district.name.toLowerCase().includes(clean))
  })
  const isEmpty = computed(() => !loadingAll.value && filteredAll.value.length === 0 && !query.value)
  const isNothingFound = computed(() => !loadingAll.value && filteredAll.value.length === 0 && !!query.value.trim())

  /**
   * Загрузить свои сообщества.
   */
  async function loadMine(): Promise<void> {
    loadingMine.value = true
    try {
      const rows = await districtsApi.list(null, true)
      mine.value = rows
    } catch {
      mine.value = []
    } finally {
      loadingMine.value = false
    }
  }

  /**
   * Загрузить витрину свежих сообществ.
   */
  async function loadAll(): Promise<void> {
    loadingAll.value = true
    try {
      const rows = await districtsApi.list(null, false)
      all.value = rows.slice(0, 60)
    } catch {
      all.value = []
    } finally {
      loadingAll.value = false
    }
  }

  /**
   * Первичная загрузка витрины.
   */
  async function init(): Promise<void> {
    await Promise.all([loadMine(), loadAll()])
  }

  /**
   * Открыть сообщество.
   *
   * @param id id района
   */
  function openDistrict(id: number): void {
    router.visit(`/districts/${id}`)
  }

  /**
   * Перейти к созданию: сначала карта (кисть), потом форма.
   */
  function goCreate(): void {
    if (!canCreate) {
      return
    }
    router.visit('/map')
  }

  /**
   * Обновить поисковый запрос.
   *
   * @param value строка поиска
   */
  function setQuery(value: string): void {
    query.value = value
  }

  onMounted(() => {
    void init()
  })

  return {
    mine,
    all,
    filteredAll,
    loadingMine,
    loadingAll,
    query,
    canCreate,
    limitText,
    isEmpty,
    isNothingFound,
    init,
    loadMine,
    loadAll,
    openDistrict,
    goCreate,
    setQuery,
  }
}
