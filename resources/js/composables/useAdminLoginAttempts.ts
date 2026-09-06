import { ref, watch } from 'vue'
import { adminApi } from '@/services/admin.api'

let searchTimer: ReturnType<typeof setTimeout> | null = null

export function useAdminLoginAttempts() {
  const items = ref<any[]>([])
  const meta = ref<any>({ total: 0, per_page: 20, current_page: 1, last_page: 1 })
  const stats = ref<{ failed_today: number; banned_total: number }>({ failed_today: 0, banned_total: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)
  const query = ref('')
  const filter = ref<'all' | 'failed' | 'success'>('failed')
  const page = ref(1)
  const actingId = ref<number | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const d: any = await adminApi.loginAttempts({
        q: query.value.trim() || undefined,
        successful: filter.value,
        page: page.value,
      })
      items.value = d.data ?? []
      meta.value = { total: d.total ?? 0, per_page: d.per_page ?? 20, current_page: d.current_page ?? 1, last_page: d.last_page ?? 1 }
      if (d.stats) stats.value = d.stats
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить логи входов'
    } finally {
      loading.value = false
    }
  }

  function setQuery(v: string) {
    query.value = v
    page.value = 1
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => void load(), 400)
  }

  function setFilter(v: 'all' | 'failed' | 'success') {
    filter.value = v
    page.value = 1
    void load()
  }

  function setPage(p: number) {
    page.value = p
    void load()
  }

  function applyBanState(userId: number, banned_at: string | null, banned_reason: string | null) {
    for (const a of items.value) {
      if (a.user && Number(a.user.id) === Number(userId)) {
        a.user.banned_at = banned_at
        a.user.banned_reason = banned_reason
      }
    }
  }

  async function ban(user: any, reason?: string) {
    if (!user?.id) return
    actingId.value = user.id
    error.value = null
    try {
      const d: any = await adminApi.banUser(user.id, reason)
      user.banned_at = d.banned_at ?? null
      user.banned_reason = d.banned_reason ?? null
      applyBanState(user.id, d.banned_at ?? null, d.banned_reason ?? null)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось заблокировать'
      throw e
    } finally {
      actingId.value = null
    }
  }

  async function unban(user: any) {
    if (!user?.id) return
    actingId.value = user.id
    error.value = null
    try {
      await adminApi.unbanUser(user.id)
      user.banned_at = null
      user.banned_reason = null
      applyBanState(user.id, null, null)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось разблокировать'
      throw e
    } finally {
      actingId.value = null
    }
  }

  watch(filter, () => void load())

  return { items, meta, stats, loading, error, query, filter, page, actingId, load, setQuery, setFilter, setPage, ban, unban }
}
