import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { useToast } from 'primevue/usetoast'
import { adminApi } from '@/services/admin.api'
import { useStaffRole } from '@/composables/useStaffRole'

export type OnlineLimit = 10 | 20 | 50 | 100
export type UsersFilter = 'all' | 'online' | 'new' | 'hidden' | 'admins' | 'organizations'
export type UsersSort = 'last_seen' | 'newest' | 'oldest' | 'name'

/**
 * Предупреждение при выдаче роли organization персональному аккаунту.
 *
 * Дублирует текст бэкенда (AdminUserController::organizationRoleWarning):
 * аккаунт person без бизнес-профиля с предпринимательской деятельностью
 * не связан — роль предназначена только для кабинета компании.
 */
export const ORGANIZATION_ROLE_WARNING =
  'Данный аккаунт персональный и не связан с предпринимательской деятельностью. ' +
  'Роль «организация» предназначена только для кабинета компании (account_type=business с реквизитами и тарифом business).'

export function useAdminMonitoring() {
  const staff = useStaffRole()
  const overview = ref<any | null>(null)
  const loadingOverview = ref(false)
  const points = ref<any[]>([])
  const summary = ref<any | null>(null)
  const chartDays = ref(14)
  const loadingChart = ref(false)
  const exporting = ref(false)
  const error = ref<string | null>(null)

  const online = ref<any[]>([])
  const onlineMeta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const onlinePage = ref(1)
  const onlineLimit = ref<OnlineLimit>(20)
  const onlineQuery = ref('')
  const loadingOnline = ref(false)

  const users = ref<any[]>([])
  const usersMeta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const usersPage = ref(1)
  const usersLimit = ref(20)
  const usersQuery = ref('')
  const usersFilter = ref<UsersFilter>('all')
  const usersSort = ref<UsersSort>('last_seen')
  const loadingUsers = ref(false)

  const actingId = ref<number | null>(null)
  const pendingSelfRole = ref<{ user: any; role: string; prevRole: string } | null>(null)
  const pendingOrganizationRole = ref<{ user: any; prevRole: string } | null>(null)
  let toast: any = null
  try { toast = useToast() } catch { toast = null }
  let timer: ReturnType<typeof setInterval> | null = null
  let searchT: ReturnType<typeof setTimeout> | null = null

  const authUserId = computed(() => {
    try {
      const authUser = (usePage().props.auth as any)?.user
      return Number(authUser?.id ?? 0) || null
    } catch {
      return null
    }
  })

  /**
   * Это текущий админ?
   * @param user строка списка пользователей
   * @returns true если user — это я
   */
  function isSelf(user: any): boolean {
    if (!user || authUserId.value === null) return false
    return Number(user.id) === Number(authUserId.value)
  }

  /**
   * Это понижение с admin до не-admin?
   * @param user строка списка пользователей
   * @param role новая роль
   * @returns true если снимаем admin-права
   */
  function isDemotion(user: any, role: string): boolean {
    const wasAdmin = !!user?.is_admin || user?.role === 'admin'
    return wasAdmin && role !== 'admin'
  }

  const onlinePct = computed(() => {
    const o = overview.value
    if (!o?.total_users) return 0
    return Math.round((o.online_users / o.total_users) * 100)
  })
  const maxChart = computed(() => Math.max(1, ...points.value.map((p) => Math.max(p.registrations, p.active, p.pins))))

  async function loadOverview() {
    loadingOverview.value = true
    try { overview.value = await adminApi.overview() }
    catch (e: any) { error.value = e?.response?.data?.message || 'Не удалось загрузить статистику' }
    finally { loadingOverview.value = false }
  }

  async function loadChart() {
    loadingChart.value = true
    try {
      const d: any = await adminApi.chart(chartDays.value)
      points.value = d?.points ?? []
      summary.value = d?.summary ?? null
    } catch { points.value = []; summary.value = null }
    finally { loadingChart.value = false }
  }

  async function exportExcel() {
    exporting.value = true
    error.value = null
    try {
      const { blob, filename } = await adminApi.exportExcel(chartDays.value)
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось скачать Excel'
    } finally {
      exporting.value = false
    }
  }

  async function loadOnline() {
    loadingOnline.value = true
    try {
      const d: any = await adminApi.online({ per_page: onlineLimit.value, page: onlinePage.value, q: onlineQuery.value.trim() || undefined })
      online.value = d?.data ?? []
      if (d?.meta) onlineMeta.value = d.meta
    } catch (e: any) { error.value = e?.response?.data?.message || 'Не удалось загрузить онлайн' }
    finally { loadingOnline.value = false }
  }

  async function loadUsers() {
    if (!staff.isAdmin.value) return
    loadingUsers.value = true
    try {
      const d: any = await adminApi.users({ q: usersQuery.value.trim() || undefined, filter: usersFilter.value, sort: usersSort.value, per_page: usersLimit.value, page: usersPage.value })
      users.value = d?.data ?? []
      if (d?.meta) usersMeta.value = d.meta
    } catch (e: any) { error.value = e?.response?.data?.message || 'Не удалось загрузить пользователей' }
    finally { loadingUsers.value = false }
  }

  function setOnlineLimit(v: OnlineLimit) {
    onlineLimit.value = v
    onlinePage.value = 1
    void loadOnline()
  }

  function setOnlinePage(p: number) {
    onlinePage.value = p
    void loadOnline()
  }

  function setUsersPage(p: number) {
    usersPage.value = p
    void loadUsers()
  }

  function setUsersFilter(f: UsersFilter) {
    usersFilter.value = f
    usersPage.value = 1
    void loadUsers()
  }

  /**
   * Мгновенно выкинуть удалённого из таблицы и подтянуть точные данные.
   *
   * Строка исчезает сразу (не висит до перезагрузки), счётчик уменьшается,
   * а фоновая перезагрузка добирает страницу и точный total.
   *
   * @param userId id удалённого пользователя
   */
  function dropUser(userId: number) {
    users.value = users.value.filter((u) => Number(u?.id) !== Number(userId))
    const total = Number(usersMeta.value?.total ?? 0)
    usersMeta.value = { ...usersMeta.value, total: Math.max(0, total - 1) }
    void loadUsers()
  }

  function refreshAll() {
    void loadOverview()
    void loadChart()
    void loadOnline()
    void loadUsers()
  }

  async function setPlan(user: any, plan: string) {
    actingId.value = user.id
    try {
      const d: any = await adminApi.updateUser(user.id, { plan })
      user.plan = d.plan
      user.effective_plan = d.effective_plan ?? d.plan
      user.plan_expires_at = d.plan_expires_at ?? null
    } finally { actingId.value = null }
  }

  /**
   * Персональный ли аккаунт (не кабинет компании).
   *
   * Кабинет = account_type business или уже есть бизнес-профиль;
   * остальное — персона, с предпринимательской деятельностью не связана.
   *
   * @param user строка списка пользователей
   * @returns true когда аккаунт персональный
   */
  function isPersonalAccount(user: any): boolean {
    if (!user) return true
    if (user.account_type === 'business' || user.is_business) return false
    if (user.business) return false
    return true
  }

  async function setRole(user: any, role: string, extra: { confirm_personal?: boolean } = {}) {
    if (!user || user.role === role) return
    actingId.value = user.id
    error.value = null
    const prevRole = user.role
    const prevIsAdmin = user.is_admin
    try {
      const updated: any = await adminApi.updateUser(user.id, { role, ...extra })
      user.role = updated.role
      user.is_admin = updated.is_admin
      if (updated.plan) user.plan = updated.plan
      if (updated.effective_plan) user.effective_plan = updated.effective_plan
      if ('plan_expires_at' in updated) user.plan_expires_at = updated.plan_expires_at
      if (updated.account_type) user.account_type = updated.account_type
      if (role === 'organization' && !updated.plan) {
        user.plan = 'business'
        user.effective_plan = 'business'
      }
      if (isSelf(user)) {
        syncAuthUser(updated)
      }
      if (isSelf(user) && isDemotion({ role: prevRole, is_admin: prevIsAdmin }, role)) {
        toast?.add({ severity: 'warn', summary: 'Роль изменена. Доступ к панели модерации потерян', life: 3500 })
        router.visit('/')
        return
      }
      if (updated.role_warning) {
        toast?.add({ severity: 'warn', summary: String(updated.role_warning), life: 6000 })
      } else if (role === 'organization') {
        toast?.add({ severity: 'success', summary: 'Роль обновлена: организация + тариф business', life: 2000 })
      } else if (role === 'moderator' || role === 'admin') {
        toast?.add({ severity: 'success', summary: 'Роль обновлена: стафф всегда на Premium', life: 2000 })
      } else {
        toast?.add({ severity: 'success', summary: 'Роль обновлена', life: 2000 })
      }
    } catch (e: any) {
      const message = e?.response?.data?.message || 'Не удалось сменить роль'
      error.value = message
      toast?.add({ severity: 'error', summary: message, life: 3500 })
      throw e
    } finally {
      actingId.value = null
    }
  }

  /**
   * Запросить смену роли. Свою с понижением — только через подтверждение.
   *
   * Роль organization персональному аккаунту — только через диалог
   * с предупреждением (аккаунт не связан с предпринимательской
   * деятельностью): бэкенд без confirm_personal ответит 422.
   *
   * @param user строка списка пользователей
   * @param role новая роль user|moderator|admin|organization
   * @returns Promise<void>
   */
  async function requestRoleChange(user: any, role: string): Promise<void> {
    if (!user || user.role === role) return
    const self = isSelf(user)
    const demotion = isDemotion(user, role)
    if (self && demotion) {
      pendingSelfRole.value = { user, role, prevRole: user.role }
      return
    }
    if (role === 'organization' && isPersonalAccount(user)) {
      pendingOrganizationRole.value = { user, prevRole: user.role }
      return
    }
    await setRole(user, role)
  }

  /**
   * Подтвердить выдачу роли organization персональному аккаунту.
   *
   * Шлёт confirm_personal: бэкенд выдаст роль + тариф business,
   * а предупреждение продублирует тостом.
   *
   * @returns Promise<void>
   */
  async function confirmOrganizationRoleChange(): Promise<void> {
    const pending = pendingOrganizationRole.value
    if (!pending) return
    pendingOrganizationRole.value = null
    await setRole(pending.user, 'organization', { confirm_personal: true })
  }

  /**
   * Отменить выдачу роли organization (подтверждение отклонено).
   */
  function cancelOrganizationRoleChange(): void {
    pendingOrganizationRole.value = null
  }

  /**
   * Подтвердить снятие admin-роли с себя.
   * @returns Promise<void>
   */
  async function confirmSelfRoleChange(): Promise<void> {
    const pending = pendingSelfRole.value
    if (!pending) return
    pendingSelfRole.value = null
    await setRole(pending.user, pending.role)
  }

  /**
   * Отменить смену своей роли.
   */
  function cancelSelfRoleChange(): void {
    pendingSelfRole.value = null
  }

  /**
   * Синхронизировать auth-пользователя Inertia после смены своей роли.
   * @param updated ответ PATCH /admin/users/{user}
   */
  function syncAuthUser(updated: any): void {
    try {
      const page = usePage()
      const authUser = (page.props.auth as any)?.user
      if (!authUser) return
      authUser.role = updated.role
      authUser.is_admin = updated.is_admin
    } catch {}
  }

  watch([usersFilter, usersSort, usersLimit], () => { usersPage.value = 1; void loadUsers() })
  watch(chartDays, () => void loadChart())
  watch([usersQuery, onlineQuery], () => {
    if (searchT) clearTimeout(searchT)
    searchT = setTimeout(() => { onlinePage.value = 1; usersPage.value = 1; void loadOnline(); void loadUsers() }, 400)
  })

  onMounted(() => {
    void refreshAll()
    timer = setInterval(() => { void loadOverview(); void loadOnline() }, 30000)
  })
  onUnmounted(() => { if (timer) clearInterval(timer); if (searchT) clearTimeout(searchT) })

  return {
    overview, loadingOverview, points, summary, chartDays, loadingChart, exporting, error,
    online, onlineMeta, onlinePage, onlineLimit, onlineQuery, loadingOnline,
    users, usersMeta, usersPage, usersLimit, usersQuery, usersFilter, usersSort, loadingUsers,
    actingId, onlinePct, maxChart, authUserId, pendingSelfRole, pendingOrganizationRole,
    loadOverview, loadChart, exportExcel, loadOnline, loadUsers, refreshAll, dropUser,
    setOnlineLimit, setOnlinePage, setUsersPage, setUsersFilter, setPlan, setRole,
    requestRoleChange, confirmSelfRoleChange, cancelSelfRoleChange,
    confirmOrganizationRoleChange, cancelOrganizationRoleChange, isPersonalAccount, isSelf,
  }
}
