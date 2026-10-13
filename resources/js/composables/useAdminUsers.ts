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

  /**
   * Состояние диалога «Создать тестового»: всё одним объектом по смыслу.
   *
   * Пароль придумывает админ (или генерирует кнопкой) — бэкенд хэширует
   * и проверяет стойкость (Password::defaults). Роль всегда user,
   * повысить через этот диалог нельзя.
   */
  const createState = ref({
    open: false,
    name: '',
    email: '',
    password: '',
    confirm: '',
    gender: 'other',
    creating: false,
    created: null as null | { id: number; name: string; email: string },
    error: null as string | null,
    copied: false,
  })

  function openCreate() {
    createState.value.open = true
    createState.value.name = ''
    createState.value.email = ''
    createState.value.password = ''
    createState.value.confirm = ''
    createState.value.created = null
    createState.value.error = null
    createState.value.copied = false
  }

  function closeCreate() {
    createState.value.open = false
  }

  /**
   * Сгенерировать пароль 16 символов (A–Z, a–z, 0–9) через Web Crypto.
   */
  function generatePassword() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    const bytes = new Uint32Array(16)
    crypto.getRandomValues(bytes)
    let out = ''
    for (const b of bytes) out += alphabet[b % alphabet.length]
    createState.value.password = out
    createState.value.confirm = out
  }

  /**
   * Скопировать выданные доступы в буфер обмена.
   */
  async function copyCreatedCredentials(): Promise<void> {
    const c = createState.value.created
    if (!c) return
    const text = `Логин: ${c.email}\nПароль: ${createState.value.password}`
    try {
      await navigator.clipboard.writeText(text)
      createState.value.copied = true
    } catch {
      createState.value.error = 'Не удалось скопировать — выделите текст вручную'
    }
  }

  /**
   * Создать тестового пользователя.
   *
   * @param onCreated колбэк после успеха (например, обновить список)
   */
  async function createTestUser(onCreated?: () => void): Promise<void> {
    if (!isAdmin.value || createState.value.creating) return
    createState.value.creating = true
    createState.value.error = null
    createState.value.copied = false
    try {
      const d: any = await adminApi.createTestUser({
        name: createState.value.name.trim(),
        email: createState.value.email.trim().toLowerCase(),
        password: createState.value.password,
        password_confirmation: createState.value.confirm,
        gender: createState.value.gender,
      })
      createState.value.created = { id: d.id, name: d.name, email: d.email }
      onCreated?.()
    } catch (e: any) {
      const bag = e?.response?.data?.errors
      const first = bag ? Object.values(bag).flat().join(' ') : null
      createState.value.error = (first as string) || e?.response?.data?.message || 'Не удалось создать пользователя'
      throw e
    } finally {
      createState.value.creating = false
    }
  }

  function askDelete(user: any) {
    if (!staff.canManageUser(user)) return
    error.value = null
    confirmDelete.value = user
  }

  /**
   * Удалить пользователя из подтверждения.
   *
   * Строка пропадает из списков сразу (не висит до перезагрузки):
   * поиск чистится здесь, а главный список — через колбэк onDeleted.
   *
   * @param onDeleted колбэк с id удалённого (например, выкинуть строку из таблицы)
   */
  async function doDelete(onDeleted?: (id: number) => void) {
    const user = confirmDelete.value
    if (!user || !staff.canManageUser(user)) return
    const userId = Number(user.id)
    deletingId.value = user.id
    error.value = null
    try {
      await adminApi.deleteUser(user.id)
      results.value = results.value.filter((u) => Number(u.id) !== userId)
      confirmDelete.value = null
      onDeleted?.(userId)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось удалить'
      throw e
    } finally {
      deletingId.value = null
    }
  }

  return { isAdmin, isModerator, canManageUser: staff.canManageUser, isAdminAccount: staff.isAdminAccount, selfHidden, selfLoading, toggleSelf, query, results, searching, error, togglingId, deletingId, confirmDelete, askDelete, doDelete, closeConfirm: () => (confirmDelete.value = null), toggleUser, searchNow, createState, openCreate, closeCreate, generatePassword, copyCreatedCredentials, createTestUser }
}
