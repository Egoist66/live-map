import { ref } from 'vue'
import { api } from '@/services/api'

export type ImpersonationLogFilter = 'all' | 'unread' | 'read'

export function useAdminImpersonationLogs() {
  const items = ref<any[]>([])
  const meta = ref({ current_page: 1, last_page: 1, per_page: 20, total: 0 })
  const page = ref(1)
  const query = ref('')
  const filter = ref<ImpersonationLogFilter>('all')
  const unreadCount = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let timer: any = null

  async function load() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get('/api/admin/impersonations', {
        params: { q: query.value || undefined, filter: filter.value, per_page: 20, page: page.value },
      })
      items.value = data?.data ?? []
      meta.value = data?.meta ?? meta.value
      unreadCount.value = Number(data?.unread_count ?? 0)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить журнал входов'
    } finally {
      loading.value = false
    }
  }

  function setPage(p: number) {
    page.value = p
    void load()
  }

  function setFilter(f: ImpersonationLogFilter) {
    filter.value = f
    page.value = 1
    void load()
  }

  function setQuery(q: string) {
    query.value = q
    page.value = 1
    clearTimeout(timer)
    timer = setTimeout(() => void load(), 350)
  }

  return { items, meta, page, query, filter, unreadCount, loading, error, load, setPage, setFilter, setQuery }
}
