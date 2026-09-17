import { computed, ref, watch } from 'vue'
import { router } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { storeToRefs } from 'pinia'
import { districtsApi } from '@/services/districts.api'
import { usePeopleSearchStore } from '@/stores/peopleSearch'
import type { District } from '@/types/entities/District'

/**
 * Поиск районов внутри глобального поиска (таб «Районы»).
 *
 * Тонкий хук над `usePeopleSearchStore`: держит запрос/выдачу,
 * открывает страницу района, кидает заявку на вступление
 * и ведёт в общий чат — знакомиться внутри.
 *
 * @example
 * const districts = useGlobalDistrictSearch()
 * districts.setQuery('центр')
 */
export function useGlobalDistrictSearch() {
  const store = usePeopleSearchStore()
  const { districtQuery, districtResults, districtSearching, districtSuggestions, districtSuggestionsLoading } = storeToRefs(store)

  const joiningId = ref<number | null>(null)

  const toast = (() => {
    try {
      return useToast()
    } catch {
      return null as unknown as ReturnType<typeof useToast>
    }
  })()

  const hasQuery = computed(() => districtQuery.value.trim().length >= 2)

  /** Первые существующие районы для пустого таба — максимум 3. */
  const suggestedDistricts = computed(() => districtSuggestions.value.slice(0, 3))

  watch(
    () => store.activeTab,
    (tab) => {
      if (tab === 'districts') {
        void store.ensureDistrictSuggestions()
      }
    },
    { immediate: true },
  )

  /**
   * Первая буква названия для аватара района.
   * @param name название района
   * @returns заглавная буква или «?»
   */
  function letterOf(name: string): string {
    const clean = String(name ?? '').trim()
    return clean ? clean.slice(0, 1).toUpperCase() : '?'
  }

  /**
   * Можно ли вступить в район одной кнопкой.
   * @param row карточка района из выдачи
   * @returns true для гостя
   */
  function canJoin(row: District): boolean {
    return row.role === 'guest'
  }

  /**
   * Можно ли открыть общий чат района.
   * @param row карточка района из выдачи
   * @returns true для жителя/владельца с чатом
   */
  function canChat(row: District): boolean {
    const isInside = row.role === 'owner' || row.role === 'member'
    return isInside && Number(row.conversation_id) > 0
  }

  /**
   * Открыть страницу района и закрыть поиск.
   * @param id id района
   */
  function openDistrict(id: number): void {
    store.closeDialog()
    router.visit(`/districts/${id}`)
  }

  /**
   * Открыть общий чат района (знакомиться внутри).
   * @param row карточка района из выдачи
   */
  function openChat(row: District): void {
    const chatId = Number(row.conversation_id)
    if (!(chatId > 0)) {
      return
    }
    store.closeDialog()
    router.visit(`/chat/${chatId}`)
  }

  /**
   * Кинуть заявку на вступление в район.
   * @param row карточка района из выдачи
   */
  async function joinDistrict(row: District): Promise<void> {
    if (joiningId.value !== null) {
      return
    }
    joiningId.value = Number(row.id)
    try {
      const res = await districtsApi.join(Number(row.id))
      const status = String(res?.status ?? '')
      const nextRole = status === 'approved' ? 'member' : 'pending'
      store.patchDistrict(Number(row.id), { role: nextRole } as Partial<District>)
      const isInstant = status === 'approved' || nextRole === 'member'
      toast?.add({
        severity: 'success',
        summary: isInstant ? 'Вы в районе' : 'Заявка отправлена',
        detail: isInstant ? 'Пины и общий чат открыты' : 'Владелец решит, пускать ли вас',
        life: 3000,
      })
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Не удалось отправить заявку'
      toast?.add({ severity: 'error', summary: 'Ошибка', detail, life: 3500 })
    } finally {
      joiningId.value = null
    }
  }

  return {
    districtQuery,
    districtResults,
    districtSearching,
    suggestedDistricts,
    districtSuggestionsLoading,
    joiningId,
    hasQuery,
    letterOf,
    canJoin,
    canChat,
    openDistrict,
    openChat,
    joinDistrict,
    setQuery: store.setDistrictQuery,
  }
}
