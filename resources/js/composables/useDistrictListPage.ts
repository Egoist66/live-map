import { computed, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { districtsApi } from '@/services/districts.api'
import { useDistrictJoinRequest } from '@/composables/useDistrictJoinRequest'
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
  /** Id района с летящей заявкой (лоадер кнопки). */
  const joiningId = ref<number | null>(null)
  /** Заявка в район: организациям — модалка цели вступления. */
  const joinRequest = useDistrictJoinRequest()

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as never
    }
  })()

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

  /**
   * Применить новую роль к карточке в обоих списках.
   *
   * @param id id района
   * @param role новая роль
   */
  function applyRole(id: number, role: District['role']): void {
    const patch = (rows: District[]): District[] => {
      return rows.map((row) => {
        if (row.id !== id) {
          return row
        }
        return { ...row, role }
      })
    }
    mine.value = patch(mine.value)
    all.value = patch(all.value)
  }

  /**
   * Показать ошибку тостом.
   *
   * @param error ответ API
   * @param fallback запасной текст
   */
  function fail(error: unknown, fallback: string): void {
    const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
    toast?.add({ severity: 'error', summary: 'Районы', detail, life: 3500 })
  }

  /**
   * Бросить заявку на вступление прямо из списка, не открывая карточку.
   *
   * Организации — через модалку цели вступления, персоны — в один клик
   * (общая логика useDistrictJoinRequest).
   *
   * @param id id района
   * @param name название района для заголовка модалки
   * @example
   * await list.joinDistrict(district.id, district.name)
   */
  async function joinDistrict(id: number, name = ''): Promise<void> {
    if (joiningId.value !== null || joinRequest.sending.value) {
      return
    }
    if (!joinRequest.isBusiness.value) {
      joiningId.value = id
    }
    try {
      await joinRequest.request(id, name, async () => {
        applyRole(id, 'pending')
        await loadMine()
      })
    } finally {
      joiningId.value = null
    }
  }

  /**
   * Принять приглашение прямо из списка.
   *
   * @param id id района
   */
  async function acceptDistrictInvite(id: number): Promise<void> {
    if (joiningId.value !== null) {
      return
    }
    joiningId.value = id
    try {
      const res = await districtsApi.acceptInvite(id)
      const role = (res?.role ?? 'member') as District['role']
      applyRole(id, role)
      toast?.add({ severity: 'success', summary: 'Вы в районе', detail: 'Пины и общий чат открыты', life: 3000 })
      await loadMine()
    } catch (error: unknown) {
      fail(error, 'Не удалось принять приглашение')
    } finally {
      joiningId.value = null
    }
  }

  /**
   * Отозвать заявку на вступление прямо из списка.
   *
   * @param id id района
   * @example
   * await list.cancelJoinRequest(district.id)
   */
  async function cancelJoinRequest(id: number): Promise<void> {
    if (joiningId.value !== null) {
      return
    }
    joiningId.value = id
    try {
      await districtsApi.leave(id)
      applyRole(id, 'guest')
      toast?.add({ severity: 'success', summary: 'Заявка отозвана', life: 2500 })
      await loadMine()
    } catch (error: unknown) {
      fail(error, 'Не удалось отозвать заявку')
    } finally {
      joiningId.value = null
    }
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
    joiningId,
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
    joinDistrict,
    joinRequest,
    acceptDistrictInvite,
    cancelJoinRequest,
  }
}
