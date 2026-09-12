import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { pinActivityApi } from '@/services/pinActivity.api'
import { api } from '@/services/api'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

export const useBadgeStore = defineStore('badges', () => {
  const unread = ref(0)
  const unreadMessages = ref(0)
  const pending = ref(0)
  const activity = ref(0)
  const reports = ref(0)
  const updates = ref(0)
  const security = ref(0)
  const loading = ref(false)
  let busBound = false
  let inited = false
  let subscribedUid: string | number | null = null

  const total = computed(() => unread.value + pending.value + activity.value + reports.value + updates.value + security.value)
  const seenMsgIds = new Set<number>()
  let fetchTimer: ReturnType<typeof setTimeout> | null = null
  let lastMutationAt = 0
  let lastRequestAt = 0
  let lastPollTickAt = 0
  let suppressUntil = 0

  function getUid(): number {
    try {
      const inertiaUid = Number((usePage().props.auth as any)?.user?.id || 0)
      if (inertiaUid) return inertiaUid
      const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (meta) return Number(meta)
    } catch {}
    return Number((window as any).userId || 0)
  }

  function noteMutation(): void {
    lastMutationAt = Date.now()
  }

  /**
   * Отложенная перезагрузка счётчиков после события шины.
   *
   * В polling-режиме тик идёт каждые ~2.5с и привозит готовые
   * badges:update — зеркальные user:*-события поллера не должны
   * устраивать тяжёлый fetch() на каждый тик, пропускаем их.
   */
  function scheduleFetch() {
    if (fetchTimer) return
    if (Date.now() - lastPollTickAt < 8000) return
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
      unread.value = (convs as any[]).filter((c: any) => Number(c?.unread_count || 0) > 0).length
      unreadMessages.value = (convs as any[]).reduce((s: number, c: any) => s + (Number(c?.unread_count) || 0), 0)
      pending.value = (fr.pending_in?.length || 0)
      activity.value = Number(ac) || 0
      reports.value = Number(rep) || 0
      updates.value = Number(upd) || 0
      security.value = Number(sec) || 0
      lastMutationAt = 0
      lastRequestAt = Date.now()
      suppressUntil = Date.now() + 4000
    } catch {}
  }

  function resolveUid(): string | number | null {
    try {
      const inertiaUid = (usePage().props.auth as any)?.user?.id ?? null
      if (inertiaUid) return inertiaUid
      const w = window as any
      if (w.userId) return w.userId
      const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
      if (meta) return meta
      return null
    } catch { return null }
  }

  function subscribe() {
    try {
      const uid = resolveUid()
      if (!uid) return
      if (subscribedUid !== null && String(subscribedUid) !== String(uid)) reset()
      subscribedUid = uid
      ensureUserChannel()
      if (busBound) return
      busBound = true
      busOn('user:message.sent', handleIncomingMessage)
      busOn('user:message.updated', () => scheduleFetch())
      busOn('user:message.deleted', () => scheduleFetch())
      busOn('user:friendship.updated', (e: any) => {
        const f = e.friendship
        const myId = Number(subscribedUid)
        if (f?.status === 'pending' && Number(f.addressee_id) === myId) pending.value += 1
        else scheduleFetch()
      })
      busOn('user:match.created', () => scheduleFetch())
      busOn('user:swipe.liked', () => scheduleFetch())
      busOn('user:message.read', () => scheduleFetch())
      busOn('user:notification.created', () => scheduleFetch())
      busOn('user:pin.counters', () => scheduleFetch())
      busOn('user:reconnected', () => fetch())
    } catch {}
  }

  function setUnread(v: number) { noteMutation(); unread.value = v }
  function setUnreadMessages(v: number) { noteMutation(); unreadMessages.value = Math.max(0, v) }
  function setPending(v: number) { noteMutation(); pending.value = v }
  function setActivity(v: number) { noteMutation(); activity.value = Math.max(0, v) }
  function decUnread() { noteMutation(); unread.value = Math.max(0, unread.value - 1) }
  function incUnread() { noteMutation(); unread.value += 1 }
  function incPending() { noteMutation(); pending.value += 1 }
  function decPending() { noteMutation(); pending.value = Math.max(0, pending.value - 1) }
  function incActivity() { noteMutation(); activity.value += 1 }
  function decActivity() { noteMutation(); activity.value = Math.max(0, activity.value - 1) }
  function setReports(v: number) { noteMutation(); reports.value = Math.max(0, v) }
  function setUpdates(v: number) { noteMutation(); updates.value = Math.max(0, v) }
  function setSecurity(v: number) { noteMutation(); security.value = Math.max(0, v) }
  function incSecurity() { noteMutation(); security.value += 1 }
  function incReports() { noteMutation(); reports.value += 1 }
  function decReports() { noteMutation(); reports.value = Math.max(0, reports.value - 1) }

  async function init() {
    if (inited) return
    inited = true
    loading.value = true
    await fetch()
    subscribe()
    try {
      busOn('badges:update', (b: any) => applyPollBadges(b))
      busOn('badges:request', (sentAt: number) => {
        lastPollTickAt = Number(sentAt) || Date.now()
        lastRequestAt = lastPollTickAt
      })
    } catch {}
    loading.value = false
    window.addEventListener('focus', fetch)
  }

  /**
   * Применяет счётчики из polling-тика одним пакетом.
   * Отбрасывает протухшие ответы: локальная правда (прочитал/сбросил)
   * всегда новее тика, запрошенного до неё — иначе счётчик "зависает".
   * @param b badges из /api/realtime/sync
   */
  function applyPollBadges(b: any): void {
    if (!b) return
    if (Date.now() < suppressUntil) return
    if (lastMutationAt > lastRequestAt) return
    if (b.unread_messages != null) setUnreadMessages(Number(b.unread_messages))
    if (b.conversations_unread != null) setUnread(Number(b.conversations_unread))
    if (b.pending_friends != null) setPending(Number(b.pending_friends))
    if (b.pin_activity != null) setActivity(Number(b.pin_activity))
    if (b.updates != null) setUpdates(Number(b.updates))
    if (b.reports_pending != null) setReports(Number(b.reports_pending))
  }

  function refresh() { return fetch() }

  /**
   * Сбросить бейджи при смене аккаунта.
   */
  function reset() {
    try {
      leaveUserChannel()
    } catch {}
    subscribedUid = null
    inited = false
    unread.value = 0
    unreadMessages.value = 0
    pending.value = 0
    activity.value = 0
    reports.value = 0
    updates.value = 0
    security.value = 0
    seenMsgIds.clear()
  }

  return { unread, unreadMessages, pending, activity, reports, updates, security, total, loading, init, fetch, refresh, reset, subscribe, setUnread, setUnreadMessages, setPending, setActivity, setReports, setUpdates, setSecurity, incSecurity, decUnread, incUnread, incPending, decPending, incActivity, decActivity, incReports, decReports }
})
