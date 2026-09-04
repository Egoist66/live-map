import { ref, computed, onMounted } from 'vue'
import { chatApi } from '@/services/chat.api'

const onlineIds = ref<Set<number>>(new Set())
let channel: any = null
let started = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let beatTimer: ReturnType<typeof setInterval> | null = null
let listenersBound = false

function getEcho(): any {
  return (window as any).Echo
}

function isInvisible(): boolean {
  try {
    const u = (window as any)?.__inertia_page?.props?.auth?.user ?? (document as any)?.__page_auth_user
    if (u?.is_invisible) return true
  } catch {}
  try {
    const el = document.querySelector('[data-page]')?.getAttribute('data-page')
    if (el) {
      const page = JSON.parse(el)
      if (page?.props?.auth?.user?.is_invisible) return true
    }
  } catch {}
  return false
}

function heartbeat() {
  if (isInvisible()) return
  chatApi.heartbeat().catch(() => {})
}

function startHeartbeat() {
  if (beatTimer) return
  heartbeat()
  beatTimer = setInterval(heartbeat, 60000)
  if (!listenersBound) {
    listenersBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { connect(); heartbeat() }
    })
    window.addEventListener('beforeunload', () => disconnect())
    window.addEventListener('pagehide', () => disconnect())
  }
}

function bindReconnect() {
  try {
    const echo = getEcho()
    const pusher = (echo as any)?.connector?.pusher
    if (pusher && !(pusher as any).__presenceBound) {
      (pusher as any).__presenceBound = true
      pusher.connection.bind('connected', () => {
        if (started && !channel) connect()
        else if (!started) connect()
      })
    }
  } catch {}
}

function connect() {
  if (started) return
  if (isInvisible()) return
  const echo = getEcho()
  if (!echo || typeof echo.join !== 'function') {
    if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; connect() }, 2500)
    return
  }
  try {
    started = true
    channel = echo.join('online')
      .here((users: any[]) => {
        const ids = users.map((u: any) => Number(u.id ?? u))
        onlineIds.value = new Set(ids)
      })
      .joining((user: any) => {
        const id = Number(user.id ?? user)
        const s = new Set(onlineIds.value)
        s.add(id)
        onlineIds.value = s
      })
      .leaving((user: any) => {
        const id = Number(user.id ?? user)
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
    startHeartbeat()
  } catch {
    channel = null
    started = false
    if (!retryTimer) retryTimer = setTimeout(() => { retryTimer = null; connect() }, 5000)
  }
}

function disconnect() {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null }
  if (beatTimer) { clearInterval(beatTimer); beatTimer = null }
  try {
    const echo = getEcho()
    if (echo && channel) echo.leave('online')
  } catch {}
  channel = null
  started = false
}

export function usePresence() {
  onMounted(() => connect())

  const isOnline = (id: number | string | null | undefined) => {
    if (id == null) return false
    return onlineIds.value.has(Number(id))
  }

  return {
    onlineIds: computed(() => onlineIds.value),
    isOnline,
    connect,
    disconnect,
  }
}

export function usePresenceState() {
  return {
    onlineIds: computed(() => onlineIds.value),
    isOnline: (id: number | string | null | undefined) => id != null && onlineIds.value.has(Number(id)),
    connect,
    disconnect,
  }
}
