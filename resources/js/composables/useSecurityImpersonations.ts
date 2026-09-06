import { ref, onMounted } from 'vue'
import { api } from '@/services/api'

export type ImpersonationEntry = {
  id: number
  reason: string
  started_at: string | null
  ended_at: string | null
  seen_at: string | null
}

export function useSecurityImpersonations(active?: any) {
  const items = ref<ImpersonationEntry[]>([])
  const unread = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get('/api/security/impersonations')
      items.value = data?.data ?? []
      unread.value = data?.unread ?? 0
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить'
    } finally {
      loading.value = false
    }
  }

  async function markRead() {
    if (!unread.value) return
    try {
      await api.post('/api/security/impersonations/read')
      unread.value = 0
      items.value = items.value.map((i) => i.seen_at ? i : { ...i, seen_at: new Date().toISOString() })
    } catch {}
  }

  onMounted(() => void load())

  return { items, unread, loading, error, load, markRead }
}
