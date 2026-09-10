import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { pinActivityApi } from '@/services/pinActivity.api'
import { api } from '@/services/api'

export const useBadgeStore = defineStore('badges', () => {
  const unread = ref(0)
  const unreadMessages = ref(0)
  const pending = ref(0)
  const activity = ref(0)
  const reports = ref(0)
  const updates = ref(0)
  const security = ref(0)
  const loading = ref(false)
  let echoCh: any = null
  let inited = false

  const total = computed(() => unread.value + pending.value + activity.value + reports.value + updates.value + security.value)
  const seenMsgIds = new Set<number>()
  let fetchTimer: ReturnType<typeof setTimeout> | null = null

  function getUid(): number {
    try {
      const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (meta) return Number(meta)
    } catch {}
    return Number((window as any).userId || 0)
  }

  function scheduleFetch() {
    if (fetchTimer) return
    fetchTimer = setTimeout(() => { fetchTimer = null; fetch() }, 400)
  }

  function handleIncomingMessage(e: any) {
    const msg = e?.message
    if (!msg?.id) { scheduleFetch(); return }
    if (seenMsgIds.has(Number(msg.id))) return
    seenMsgIds.add(Number(msg.id))
    if (seenMsgIds.size > 300) seenMsgIds.delete(seenMsgIds.values().next().value!)
    if (Number(msg.sender_id) === getUid()) return
    scheduleFetch()
  }

  function readIsAdmin(): boolean {
    try {
      const u = (usePage().props.auth as any)?.user
      return !!u?.is_admin || u?.role === 'admin'
    } catch { return false }
  }

  async function fetch() {
    try {
      const w = window as any
      const convsPromise = w.__conversationsInflight ? w.__conversationsInflight : chatApi.conversations().catch(() => [] as any[])
      const repPromise = readIsAdmin()
        ? api.get('/api/admin/reports', { params: { status: 'pending', per_page: 1 } }).then((r) => Number(r.data?.pending_count ?? 0)).catch(() => 0)
        : Promise.resolve(0)
      const updPromise = readIsAdmin()
        ? Promise.resolve(0)
        : api.get('/api/updates/unread').then((r) => Number(r.data?.count ?? 0)).catch(() => 0)
      const [convs, fr, ac, rep, upd, sec] = await Promise.all([
        convsPromise,
        chatApi.friendships().catch(() => ({ pending_in: [] } as any)),
        pinActivityApi.unreadCount().catch(() => 0),
        repPromise,
        updPromise,
        api.get('/api/security/impersonations').then((r) => Number(r.data?.unread ?? 0)).catch(() => 0),
      ])
      unread.value = (convs as any[]).filter((c: any) => Number(c.unread_count || 0) > 0).length
      unreadMessages.value = (convs as any[]).reduce((s: number, c: any) => s + (Number(c.unread_count) || 0), 0)
      pending.value = (fr.pending_in?.length || 0)
      activity.value = Number(ac) || 0
      reports.value = Number(rep) || 0
      updates.value = Number(upd) || 0
      security.value = Number(sec) || 0
    } catch {}
  }

  function resolveUid(): string | number | null {
    try {
      const w = window as any
      if (w.userId) return w.userId
      const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (meta) return meta
      return (usePage().props.auth as any)?.user?.id ?? null
    } catch { return null }
  }

  function subscribe() {
    try {
      const echo = (window as any).Echo
      if (!echo) return
      const uid = resolveUid()
      if (!uid) return
      if (echoCh) return
      echoCh = echo.private(`user.${uid}`)
      echoCh.listen('.message.sent', handleIncomingMessage)
      echoCh.listen('.message.updated', () => scheduleFetch())
      echoCh.listen('.message.deleted', () => scheduleFetch())
      echoCh.listen('.friendship.updated', (e: any) => {
        const f = e.friendship
        const myId = Number(uid)
        if (f?.status === 'pending' && Number(f.addressee_id) === myId) pending.value += 1
        else scheduleFetch()
      })
      echoCh.listen('.message.read', () => scheduleFetch())
      echoCh.listen('.pin.activity', () => scheduleFetch())
      echoCh.listen('PinActivityCreated', () => scheduleFetch())
      echoCh.listen('.user.feed.updated', () => scheduleFetch())
      echoCh.listen('UserFeedUpdated', () => scheduleFetch())
      const pusher = (echo as any).connector?.pusher
      if (pusher) {
        pusher.connection.bind('connected', () => fetch())
      }
    } catch {}
  }

  function setUnread(v: number) { unread.value = v }
  function setUnreadMessages(v: number) { unreadMessages.value = Math.max(0, v) }
  function setPending(v: number) { pending.value = v }
  function setActivity(v: number) { activity.value = Math.max(0, v) }
  function decUnread() { unread.value = Math.max(0, unread.value - 1) }
  function incUnread() { unread.value += 1 }
  function incPending() { pending.value += 1 }
  function decPending() { pending.value = Math.max(0, pending.value - 1) }
  function incActivity() { activity.value += 1 }
  function decActivity() { activity.value = Math.max(0, activity.value - 1) }
  function setReports(v: number) { reports.value = Math.max(0, v) }
  function setUpdates(v: number) { updates.value = Math.max(0, v) }
  function setSecurity(v: number) { security.value = Math.max(0, v) }
  function incSecurity() { security.value += 1 }
  function incReports() { reports.value += 1 }
  function decReports() { reports.value = Math.max(0, reports.value - 1) }

  async function init() {
    if (inited) return
    inited = true
    loading.value = true
    await fetch()
    subscribe()
    loading.value = false
    window.addEventListener('focus', fetch)
  }

  function refresh() { return fetch() }

  return { unread, unreadMessages, pending, activity, reports, updates, security, total, loading, init, fetch, refresh, subscribe, setUnread, setUnreadMessages, setPending, setActivity, setReports, setUpdates, setSecurity, incSecurity, decUnread, incUnread, incPending, decPending, incActivity, decActivity, incReports, decReports }
})
