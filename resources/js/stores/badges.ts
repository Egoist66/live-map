import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { notificationsApi } from '@/services/notifications.api'
import { api } from '@/services/api'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'
import { captureAuthUid, currentAuthUid } from '@/composables/useAuthUid'
import { isAdminBlockedClient } from '@/composables/useAdminClientGate'

export const useBadgeStore = defineStore('badges', () => {
  captureAuthUid()
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
  let lastFetchAt = 0
  let fetchBlockedUntil = 0
  const FETCH_MIN_INTERVAL = 15000
  const FETCH_BLOCK_AFTER_429 = 20000

  function getUid(): number {
    const cached = currentAuthUid()
    if (cached > 0) return cached
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
   * устраивать тяжёлый fetch() из 6 параллельных запросов на каждый
   * тик, иначе общее ведро уходит в 429 при движении карты.
   */
  function scheduleFetch() {
    if (fetchTimer) {
      return
    }
    if (Date.now() - lastPollTickAt < 30000) {
      return
    }
    fetchTimer = setTimeout(() => {
      fetchTimer = null
      void fetch()
    }, 1500)
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

  /**
   * Может ли пользователь разбирать жалобы (модератор и выше).
   *
   * Админ — тоже модератор, поэтому бейдж pending-жалоб
   * показываем всей staff-команде, а не только админам.
   * В Telegram/WebView — нет: модерация там запрещена,
   * лишний запрос в `/api/admin/*` не шлём.
   */
  function readCanModerate(): boolean {
    try {
      if (isAdminBlockedClient()) return false
      const u = (usePage().props.auth as any)?.user
      return !!u?.is_admin || u?.role === 'admin' || u?.role === 'moderator'
    } catch { return false }
  }

  /**
   * Полный админ (новости обновлений ему не показываем —
   * он их публикует; модератор видит новости как обычный юзер).
   */
  function readIsFullAdmin(): boolean {
    try {
      const u = (usePage().props.auth as any)?.user
      return !!u?.is_admin || u?.role === 'admin'
    } catch { return false }
  }

  /**
   * Затянуть счётчики бейджей одним пакетом.
   *
   * Шесть параллельных запросов разом — главный кандидат на 429 рядом
   * с тиком realtime/sync и догрузкой карты. Не чаще раза в 15с, после
   * 429 молчим 20с: свежие цифры всё равно привозит badges:update тика.
   *
   * @param force игнорировать минимальный интервал (первая загрузка)
   */
  async function fetch(force = false) {
    const now = Date.now()
    if (!force && now < fetchBlockedUntil) {
      return
    }
    if (!force && now - lastFetchAt < FETCH_MIN_INTERVAL) {
      return
    }
    lastFetchAt = now
    try {
      const w = window as any
      const convsPromise = w.__conversationsInflight ? w.__conversationsInflight : chatApi.conversations().catch(() => [] as any[])
      const repPromise = readCanModerate()
        ? api.get('/api/admin/reports', { params: { status: 'pending', per_page: 1 } }).then((r) => Number(r.data?.pending_count ?? 0)).catch(() => 0)
        : Promise.resolve(0)
      const updPromise = readIsFullAdmin()
        ? Promise.resolve(0)
        : api.get('/api/updates/unread').then((r) => Number(r.data?.count ?? 0)).catch(() => 0)
      const results = await Promise.allSettled([
        convsPromise,
        chatApi.friendships().catch(() => ({ pending_in: [] } as any)),
        notificationsApi.unreadCount().then((r) => r.total).catch(() => 0),
        repPromise,
        updPromise,
        api.get('/api/security/impersonations').then((r) => Number(r.data?.unread ?? 0)).catch(() => 0),
      ])
      const valueOf = (index: number, fallback: unknown) => {
        const settled = results[index]
        if (settled.status !== 'fulfilled') {
          return fallback
        }
        return settled.value
      }
      const convs = valueOf(0, [])
      const fr = valueOf(1, { pending_in: [] })
      const ac = valueOf(2, 0)
      const rep = valueOf(3, 0)
      const upd = valueOf(4, 0)
      const sec = valueOf(5, 0)
      const throttled = results.some(
        (r) => r.status === 'rejected' && Number((r.reason as any)?.response?.status) === 429,
      )
      if (throttled) {
        fetchBlockedUntil = Date.now() + FETCH_BLOCK_AFTER_429
      }
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
    const cached = currentAuthUid()
    if (cached > 0) return cached
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

  /**
   * Перезагрузка по возврату во вкладку, но не чаще интервала fetch.
   */
  function onWindowFocus(): void {
    void fetch()
  }

  async function init() {
    if (inited) return
    inited = true
    loading.value = true
    await fetch(true)
    subscribe()
    try {
      busOn('badges:update', (b: any) => applyPollBadges(b))
      busOn('badges:request', (sentAt: number) => {
        lastPollTickAt = Number(sentAt) || Date.now()
        lastRequestAt = lastPollTickAt
      })
    } catch {}
    loading.value = false
    window.addEventListener('focus', onWindowFocus)
  }

  /**
   * Применяет счётчики из polling-тика одним пакетом.
   * Отбрасывает протухшие ответы: локальная правда (прочитал/сбросил)
   * всегда новее тика, запрошенного до неё — иначе счётчик "зависает".
   * Пишет напрямую в ref без noteMutation: применение серверного тика —
   * не локальная мутация, иначе каждый тик помечал бы себя мутацией
   * и все следующие тики отбрасывались бы навсегда (залипший бейдж).
   * @param b badges из /api/realtime/sync
   */
  function applyPollBadges(b: any): void {
    if (!b) return
    if (Date.now() < suppressUntil) return
    if (lastMutationAt > lastRequestAt) return
    if (b.unread_messages != null) unreadMessages.value = Math.max(0, Number(b.unread_messages) || 0)
    if (b.conversations_unread != null) unread.value = Math.max(0, Number(b.conversations_unread) || 0)
    if (b.pending_friends != null) pending.value = Math.max(0, Number(b.pending_friends) || 0)
    if (b.pin_activity != null) activity.value = Math.max(0, Number(b.pin_activity) || 0)
    if (b.updates != null) updates.value = Math.max(0, Number(b.updates) || 0)
    if (b.reports_pending != null) reports.value = Math.max(0, Number(b.reports_pending) || 0)
  }

  function refresh() { return fetch(true) }

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
