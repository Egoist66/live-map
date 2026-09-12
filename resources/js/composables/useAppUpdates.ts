import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { appUpdatesApi } from '@/services/app-updates.api'
import { useBadgeStore } from '@/stores/badges'
import { busOn } from '@/services/realtime-bus'

const queue = ref<any[]>([])
const history = ref<any[]>([])
const unreadCount = ref(0)
const loading = ref(false)
const inited = ref(false)
let busBound = false

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
    const id = Number(item.id)
    try {
      await appUpdatesApi.markRead(id)
    } catch {}
    queue.value = queue.value.filter((x) => Number(x.id) !== id)
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    const h = history.value.find((x) => Number(x.id) === id)
    if (h) h.is_read = true
    else history.value = [{ ...item, is_read: true }, ...history.value]
    syncBadge()
    try {
      const d: any = await appUpdatesApi.unread()
      const serverCount = Number(d?.count ?? unreadCount.value)
      if (serverCount !== unreadCount.value) unreadCount.value = serverCount
      const fresh = d?.updates ?? []
      const knownIds = new Set(queue.value.map((x) => Number(x.id)))
      for (const u of fresh) {
        if (!knownIds.has(Number(u.id))) queue.value.push(u)
      }
      syncBadge()
    } catch {}
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
    if (!queue.value.length) return
    const [first, ...rest] = queue.value
    queue.value = [...rest, first]
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
    if (!busBound) {
      busBound = true
      try {
        busOn('user:notification.created', (e: any) => {
          const n = e?.notification
          if (!n?.id || n.type !== 'app.published' || !n.data?.update) return
          mergeIncoming([n.data.update])
        })
      } catch {}
    }
  }

  /**
   * Вливает новости из поллинга в очередь (модалка покажет сама).
   * @param updates новости из /api/realtime/sync
   */
  function mergeIncoming(updates: any[]): void {
    if (!Array.isArray(updates) || !updates.length) return
    if (readIsAdmin()) return
    const known = new Set(queue.value.map((x) => Number(x.id)))
    let added = false
    for (const u of updates) {
      if (u?.id == null || known.has(Number(u.id))) continue
      known.add(Number(u.id))
      queue.value.push(u)
      added = true
    }
    if (added) syncBadge()
  }

  return { queue, history, sortedHistory, unreadCount, loading, current, hasUnread, loadUnread, loadHistory, dismissCurrent, dismissAll, snooze, preview, init }
}
