import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { adminApi } from '@/services/admin.api'

export type OnlineLimit = 10 | 20 | 50 | 100
export type UsersFilter = 'all' | 'online' | 'new' | 'hidden' | 'admins'
export type UsersSort = 'last_seen' | 'newest' | 'oldest' | 'name'

export function useAdminMonitoring() {
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
  let timer: ReturnType<typeof setInterval> | null = null
  let searchT: ReturnType<typeof setTimeout> | null = null

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
    } finally { actingId.value = null }
  }

  async function setRole(user: any, role: string) {
    actingId.value = user.id
    try {
      const d: any = await adminApi.updateUser(user.id, { role })
      user.role = d.role
      user.is_admin = d.is_admin
    } finally { actingId.value = null }
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
    actingId, onlinePct, maxChart,
    loadOverview, loadChart, exportExcel, loadOnline, loadUsers, refreshAll,
    setOnlineLimit, setOnlinePage, setUsersPage, setUsersFilter, setPlan, setRole,
  }
}
