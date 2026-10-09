import { computed, ref } from 'vue'
import { api } from '@/services/api'
import { useBadgeStore } from '@/stores/badges'
import { busOn } from '@/services/realtime-bus'
import { ensureUserChannel, leaveUserChannel } from '@/composables/useUserChannel'

export type ImpersonationEntry = {
  id: number
  reason: string
  started_at: string | null
  ended_at: string | null
  seen_at: string | null
}

const items = ref<ImpersonationEntry[]>([])
const unread = ref(0)
const loading = ref(false)
const error = ref<string | null>(null)
let busBound = false
let inited = false

function getUid(): number {
  try {
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
  } catch {}
  return Number((window as any).userId || 0)
}

function onStarted(e: any) {
  const log = e?.log
  if (!log?.id) return
  if (items.value.some((x) => x.id === log.id)) return
  items.value = [{ id: log.id, reason: log.reason ?? '', started_at: log.started_at ?? null, ended_at: null, seen_at: null }, ...items.value].slice(0, 50)
  unread.value += 1
  try { useBadgeStore().incSecurity() } catch {}
}

/**
 * Inbox-дубль служебного входа (polling-режим и сокет).
 *
 * Сокет шлёт и прямое событие user:impersonation.started, и inbox-строку
 * user:notification.created; поллер — только inbox-строку. Дедуп по id
 * не даёт задвоения счётчика: кто первый вставил строку, тот и +1.
 *
 * @param e событие user:notification.created
 */
function onInboxNotification(e: any) {
  const n = e?.notification
  if (!n?.id || n.type !== 'security.impersonation') return
  if (n.read_at) return
  const log = n.data?.log
  if (!log?.id) return
  onStarted({ log })
}

function subscribe() {
  try {
    const uid = getUid()
    if (!uid) return
    ensureUserChannel()
    if (busBound) return
    busBound = true
    busOn('user:impersonation.started', onStarted)
    busOn('user:notification.created', onInboxNotification)
  } catch {}
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const { data } = await api.get('/api/security/impersonations')
    items.value = data?.data ?? []
    unread.value = Number(data?.unread ?? 0)
    try { useBadgeStore().setSecurity(unread.value) } catch {}
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Не удалось загрузить'
  } finally {
    loading.value = false
  }
}

async function markRead() {
  if (!unread.value) return
  unread.value = 0
  items.value = items.value.map((i) => (i.seen_at ? i : { ...i, seen_at: new Date().toISOString() }))
  try { useBadgeStore().setSecurity(0) } catch {}
  try {
    await api.post('/api/security/impersonations/read')
  } catch {}
}

function init() {
  if (inited) return
  inited = true
  void load()
  subscribe()
  window.addEventListener('focus', subscribe)
}

/**
 * Сбросить журнал входов при смене аккаунта.
 */
export function resetSecurityImpersonations(): void {
  try {
    leaveUserChannel()
  } catch {}
  inited = false
  items.value = []
  unread.value = 0
  error.value = null
}

export function useSecurityImpersonations(_active?: any) {
  const hasEvents = computed(() => items.value.length > 0 || unread.value > 0)
  return { items, unread, loading, error, hasEvents, load, markRead, init, subscribe }
}
