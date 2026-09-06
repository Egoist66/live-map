import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { appUpdatesApi } from '@/services/app-updates.api'
import { useBadgeStore } from '@/stores/badges'

const queue = ref<any[]>([])
const history = ref<any[]>([])
const unreadCount = ref(0)
const loading = ref(false)
const inited = ref(false)

function readIsAdmin(): boolean {
  try {
    const u = (usePage().props.auth as any)?.user
    return !!u?.is_admin || u?.role === 'admin'
  } catch { return false }
}

function syncBadge() {
  try { useBadgeStore().setUpdates(unreadCount.value) } catch {}
}

export function useAppUpdates() {
  const current = computed(() => queue.value[0] ?? null)
  const hasUnread = computed(() => queue.value.length > 0)
  const sortedHistory = computed(() => [...history.value].sort((a, b) => Number(a.is_read ? 1 : 0) - Number(b.is_read ? 1 : 0)))

  async function loadUnread() {
    if (readIsAdmin()) { queue.value = []; unreadCount.value = 0; return }
    loading.value = true
    try {
      const d: any = await appUpdatesApi.unread()
      queue.value = d?.updates ?? []
      unreadCount.value = Number(d?.count ?? queue.value.length)
    } catch {
      queue.value = []
    } finally {
      loading.value = false
      syncBadge()
    }
  }

  async function loadHistory() {
    if (readIsAdmin()) { history.value = []; return }
    try {
      history.value = await appUpdatesApi.list()
    } catch {
      history.value = []
    }
  }

  async function dismissCurrent() {
    const item = current.value
    if (!item) return
    try {
      await appUpdatesApi.markRead(item.id)
    } catch {}
    queue.value = queue.value.slice(1)
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    const h = history.value.find((x) => x.id === item.id)
    if (h) h.is_read = true
    syncBadge()
  }

  async function dismissAll() {
    try {
      await appUpdatesApi.markAllRead()
    } catch {}
    queue.value = []
    unreadCount.value = 0
    history.value = history.value.map((x) => ({ ...x, is_read: true }))
    syncBadge()
  }

  function snooze() {
    queue.value = queue.value.slice(1)
  }

  function preview(item: any) {
    if (!item) return
    queue.value = [item, ...queue.value.filter((x) => x.id !== item.id)]
  }

  function init() {
    if (inited.value) return
    inited.value = true
    if (readIsAdmin()) return
    void loadUnread()
    void loadHistory()
  }

  return { queue, history, sortedHistory, unreadCount, loading, current, hasUnread, loadUnread, loadHistory, dismissCurrent, dismissAll, snooze, preview, init }
}
