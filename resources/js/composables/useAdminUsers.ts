import { ref, computed, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { adminApi } from '@/services/admin.api'
import { useStaffRole } from '@/composables/useStaffRole'

let searchTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Поиск и действия над пользователями в панели модерации.
 *
 * Модераторы ищут, скрывают и удаляют только обычных
 * пользователей; админов им бэкенд не отдаёт в поиске,
 * а мутации по админам запрещает (403). Полные проверки —
 * в `useStaffRole().canManageUser()`.
 */
export function useAdminUsers() {
  const page = usePage()
  const staff = useStaffRole()
  const authUser = computed(() => (page.props.auth as any)?.user)
  const isAdmin = staff.isAdmin
  const isModerator = staff.isModerator
  const selfHidden = ref(!!authUser.value?.is_hidden_from_search)
  const selfLoading = ref(false)

  const query = ref('')
  const results = ref<any[]>([])
  const searching = ref(false)
  const error = ref<string | null>(null)
  const togglingId = ref<number | null>(null)
  const deletingId = ref<number | null>(null)
  const confirmDelete = ref<any | null>(null)

  watch(() => (authUser.value as any)?.is_hidden_from_search, (v) => { selfHidden.value = !!v })

  async function toggleSelf(value?: boolean) {
    if (!isModerator.value) return
    const next = value ?? !selfHidden.value
    selfLoading.value = true
    error.value = null
    try {
      const d: any = await adminApi.setVisibility(authUser.value.id, next)
      selfHidden.value = !!d.is_hidden_from_search
      try { if ((page.props.auth as any)?.user) (page.props.auth as any).user.is_hidden_from_search = selfHidden.value } catch {}
      syncResult(authUser.value.id, selfHidden.value)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось обновить'
      throw e
    } finally {
      selfLoading.value = false
    }
  }

  function syncResult(userId: number, hidden: boolean) {
    const item = results.value.find((u) => Number(u.id) === Number(userId))
    if (item) item.is_hidden_from_search = hidden
  }

  async function searchNow(q: string) {
    if (!isModerator.value) return
    const term = q.trim()
    if (term.length < 2) { results.value = []; searching.value = false; return }
    searching.value = true
    error.value = null
    try {
      results.value = await adminApi.searchUsers(term)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Ошибка поиска'
    } finally {
      searching.value = false
    }
  }

  watch(query, (q) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => searchNow(q), 350)
  })

  async function toggleUser(user: any, value?: boolean) {
    if (!staff.canManageUser(user)) return
    const next = value ?? !user.is_hidden_from_search
    togglingId.value = user.id
    error.value = null
    const prev = user.is_hidden_from_search
    user.is_hidden_from_search = next
    try {
      const d: any = await adminApi.setVisibility(user.id, next)
      user.is_hidden_from_search = !!d.is_hidden_from_search
      if (Number(user.id) === Number(authUser.value?.id)) {
        selfHidden.value = !!d.is_hidden_from_search
        try { (page.props.auth as any).user.is_hidden_from_search = selfHidden.value } catch {}
      }
    } catch (e: any) {
      user.is_hidden_from_search = prev
      error.value = e?.response?.data?.message || 'Не удалось обновить'
      throw e
    } finally {
      togglingId.value = null
    }
  }

  function askDelete(user: any) {
    if (!staff.canManageUser(user)) return
    confirmDelete.value = user
  }

  async function doDelete() {
    const user = confirmDelete.value
    if (!user || !staff.canManageUser(user)) return
    deletingId.value = user.id
    error.value = null
    try {
      await adminApi.deleteUser(user.id)
      results.value = results.value.filter((u) => Number(u.id) !== Number(user.id))
      confirmDelete.value = null
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось удалить'
      throw e
    } finally {
      deletingId.value = null
    }
  }

  return { isAdmin, isModerator, canManageUser: staff.canManageUser, isAdminAccount: staff.isAdminAccount, selfHidden, selfLoading, toggleSelf, query, results, searching, error, togglingId, deletingId, confirmDelete, askDelete, doDelete, closeConfirm: () => (confirmDelete.value = null), toggleUser, searchNow }
}
