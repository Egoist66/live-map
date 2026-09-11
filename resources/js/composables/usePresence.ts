import { ref, computed, onMounted } from 'vue'
import { chatApi } from '@/services/chat.api'

const onlineIds = ref<Set<number>>(new Set())
let channel: any = null
let started = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempts = 0
const MAX_RETRY_ATTEMPTS = 10
let beatTimer: ReturnType<typeof setInterval> | null = null
let listenersBound = false

function getEcho(): any {
  return (window as any).Echo
}

const selfInvisible = ref(false)

export function setPresenceInvisible(v: boolean) {
  selfInvisible.value = v
  if (v) leaveChannel()
  else connect()
}

function readSelfInvisibleFromPage(): boolean | null {
  try {
    const u = (window as any)?.__inertia_page?.props?.auth?.user ?? (document as any)?.__page_auth_user
    if (u && typeof u.is_invisible !== 'undefined') return !!u.is_invisible
  } catch {}
  try {
    const el = document.querySelector('[data-page]')?.getAttribute('data-page')
    if (el) {
      const u = JSON.parse(el)?.props?.auth?.user
      if (u && typeof u.is_invisible !== 'undefined') return !!u.is_invisible
    }
  } catch {}
  return null
}

function isInvisible(): boolean {
  return selfInvisible.value
}

export const ONLINE_THRESHOLD_MS = 180000

export function isRecentlySeen(lastSeenAt: string | null | undefined, thresholdMs = ONLINE_THRESHOLD_MS): boolean {
  if (!lastSeenAt) return false
  try {
    const t = new Date(lastSeenAt).getTime()
    if (Number.isNaN(t)) return false
    return Date.now() - t < thresholdMs
  } catch { return false }
}

function heartbeat() {
  if (isInvisible()) return
  chatApi.heartbeat().catch(() => {})
}

function ensureHeartbeat() {
  if (beatTimer) return
  heartbeat()
  beatTimer = setInterval(heartbeat, 60000)
}

function bindGlobalListeners() {
  if (listenersBound) return
  listenersBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { connect(); heartbeat() }
  })
  window.addEventListener('beforeunload', () => disconnect())
  window.addEventListener('pagehide', () => disconnect())
}

function bindReconnect() {
  try {
    const echo = getEcho()
    const pusher = (echo as any)?.connector?.pusher
    if (pusher && !(pusher as any).__presenceBound) {
      (pusher as any).__presenceBound = true
      pusher.connection.bind('connected', () => {
        if (!started || !channel) { started = false; channel = null; connect() }
      })
      pusher.connection.bind('disconnected', () => {
        channel = null
        started = false
      })
    }
  } catch {}
}

function connect() {
  bindGlobalListeners()
  const fromPage = readSelfInvisibleFromPage()
  if (fromPage !== null) selfInvisible.value = fromPage
  ensureHeartbeat()
  if (isInvisible()) { leaveChannel(); return }
  if (started && channel) return
  const echo = getEcho()
  if (!echo || typeof echo.join !== 'function') {
    if (!retryTimer && retryAttempts < MAX_RETRY_ATTEMPTS) {
      retryAttempts += 1
      retryTimer = setTimeout(() => { retryTimer = null; connect() }, 2500)
    }
    return
  }
  retryAttempts = 0
  try {
    try { if (channel) echo.leave('online') } catch {}
    started = true
    channel = echo.join('online')
      .here((users: any[]) => {
        const ids = (users || []).map((u: any) => Number(u?.id ?? u)).filter((n) => Number.isFinite(n))
        onlineIds.value = new Set(ids)
      })
      .joining((user: any) => {
        const id = Number(user?.id ?? user)
        if (!Number.isFinite(id)) return
        const s = new Set(onlineIds.value)
        s.add(id)
        onlineIds.value = s
      })
      .leaving((user: any) => {
        const id = Number(user?.id ?? user)
        if (!Number.isFinite(id)) return
        const s = new Set(onlineIds.value)
        s.delete(id)
        onlineIds.value = s
      })
      .error(() => {
        channel = null
        started = false
        if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; connect() }, 5000)
      })
    bindReconnect()
  } catch {
    channel = null
    started = false
    if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; connect() }, 5000)
  }
}

function leaveChannel() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  try {
    const echo = getEcho()
    if (echo && channel) echo.leave('online')
  } catch {}
  channel = null
  started = false
}

function disconnect() {
  if (beatTimer) { clearInterval(beatTimer); beatTimer = null }
  leaveChannel()
}

export function resetPresence() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  if (beatTimer) { clearInterval(beatTimer); beatTimer = null }
  try {
    const echo = getEcho()
    if (echo && channel) echo.leave('online')
  } catch {}
  channel = null
  started = false
  onlineIds.value = new Set()
  selfInvisible.value = false
}

export function isOnlineWithFallback(id: number | string | null | undefined, lastSeenAt?: string | null): boolean {
  if (id == null) return false
  if (onlineIds.value.has(Number(id))) return true
  return isRecentlySeen(lastSeenAt)
}

export function usePresence() {
  onMounted(() => connect())

  const isOnline = (id: number | string | null | undefined, lastSeenAt?: string | null) => {
    if (id == null) return false
    if (onlineIds.value.has(Number(id))) return true
    return isRecentlySeen(lastSeenAt)
  }

  return {
    onlineIds: computed(() => onlineIds.value),
    isOnline,
    connect,
    disconnect,
    resetPresence,
  }
}

export function usePresenceState() {
  return {
    onlineIds: computed(() => onlineIds.value),
    isOnline: (id: number | string | null | undefined, lastSeenAt?: string | null) => {
      if (id == null) return false
      if (onlineIds.value.has(Number(id))) return true
      return isRecentlySeen(lastSeenAt)
    },
    connect,
    disconnect,
  }
}
