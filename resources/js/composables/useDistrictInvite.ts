import { ref } from 'vue'
import { districtsApi } from '@/services/districts.api'
import { api } from '@/services/api'

/**
 * Приглашения в UDistrict: владелец зовёт людей, те решают сами.
 *
 * Приглашённый жмёт «Принять / Отклонить» в уведомлениях или карточке
 * района (диплинк /map?district=) — так зовут даже тех, кто район
 * на карте не видит (вне своей зоны). Используется из модалки района.
 *
 * @example
 * const invite = useDistrictInvite()
 * invite.open(12)
 */
export function useDistrictInvite() {
  /** Диалог приглашения открыт. */
  const open = ref(false)
  /** Район, куда зовём. */
  const districtId = ref(0)
  const districtName = ref('')
  /** Поиск людей по имени. */
  const query = ref('')
  const results = ref<any[]>([])
  const searching = ref(false)
  const invitingId = ref(0)
  const error = ref<string | null>(null)
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Открыть диалог для района.
   *
   * @param id id района
   * @param name название для заголовка
   */
  function show(id: number, name = ''): void {
    districtId.value = id
    districtName.value = name
    query.value = ''
    results.value = []
    error.value = null
    open.value = true
  }

  /**
   * Закрыть диалог и сбросить поиск.
   */
  function close(): void {
    open.value = false
    query.value = ''
    results.value = []
    error.value = null
    invitingId.value = 0
  }

  /**
   * Сеттер для шаблонов (прямое присваивание затрёт ref).
   *
   * @param v открыт ли диалог
   */
  function setOpen(v: boolean): void {
    if (!v) {
      close()
      return
    }
    open.value = true
  }

  /**
   * Искать людей по имени (дебаунс 350мс, минимум 2 символа).
   *
   * @param q строка поиска
   */
  function search(q: string): void {
    query.value = q
    error.value = null
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
    const clean = q.trim()
    if (clean.length < 2) {
      results.value = []
      searching.value = false
      return
    }
    searching.value = true
    searchTimer = setTimeout(async () => {
      try {
        const { data } = await api.get('/api/chat/users/search', { params: { q: clean } })
        const rows = Array.isArray(data) ? data : []
        results.value = rows
      } catch {
        results.value = []
      } finally {
        searching.value = false
      }
    }, 350)
  }

  /**
   * Пригласить человека в район (в житель он войдёт сам, через «Принять»).
   *
   * @param userId кого зовём
   * @returns true когда приглашение отправлено
   */
  async function invite(userId: number): Promise<boolean> {
    if (!(districtId.value > 0) || !(userId > 0)) {
      return false
    }
    invitingId.value = userId
    error.value = null
    try {
      await districtsApi.invite(districtId.value, userId)
      results.value = results.value.filter((u) => Number(u.id) !== Number(userId))
      return true
    } catch (e: any) {
      const message = e?.response?.data?.message ?? 'Не удалось пригласить'
      error.value = message
      return false
    } finally {
      invitingId.value = 0
    }
  }

  return {
    open,
    districtId,
    districtName,
    query,
    results,
    searching,
    invitingId,
    error,
    show,
    close,
    setOpen,
    search,
    invite,
  }
}
