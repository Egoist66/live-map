import { computed, ref } from 'vue'
import { api } from '@/services/api'
import { useBadgeStore } from '@/stores/badges'

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
let echoCh: any = null
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

function subscribe() {
  try {
    const echo = (window as any).Echo
    if (!echo || echoCh) return
    const uid = getUid()
    if (!uid) return
    echoCh = echo.private(`user.${uid}`)
    echoCh.listen('.impersonation.started', onStarted)
    echoCh.listen('ImpersonationStarted', onStarted)
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

export function useSecurityImpersonations(_active?: any) {
  const hasEvents = computed(() => items.value.length > 0 || unread.value > 0)
  return { items, unread, loading, error, hasEvents, load, markRead, init, subscribe }
}
