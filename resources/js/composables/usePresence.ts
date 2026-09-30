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

/**
 * Пинг онлайна: продлевает last_seen_at.
 *
 * В фоне (свёрнутый Mini App, другая вкладка) не пингуем — иначе
 * свёрнутый выглядит «онлайн» и дубли событий в Telegram-бота
 * (см. User::isAway) не уходят, а человек их пропускает. Возврат
 * на вкладку сразу шлёт пинг через visibilitychange ниже.
 */
function heartbeat() {
  if (isInvisible()) return
  try {
    if (typeof document !== 'undefined' && document.hidden) return
  } catch { /* без DOM — пингуем как обычно */ }
  chatApi.heartbeat().catch(() => {})
}

function ensureHeartbeat() {
  if (beatTimer) return
  heartbeat()
  beatTimer = setInterval(heartbeat, 60000)
}

/**
 * Сказать бэку «Mini App закрыт» даже когда страница уже умирает.
 *
 * Обычный axios на pagehide не успевает (страница выгружена), а без
 * этого last_seen_at остаётся свежим ещё ~3 минуты порога isAway —
 * и дубли сообщений/лайков/мэтчей в Telegram-бота не уходят. Шлём
 * fetch с keepalive + куками сессии + XSRF из куки: Laravel примет
 * POST без 419, бэк сдвинет last_seen_at на 5 минут назад.
 *
 * @returns void (ошибки глотаем — страница всё равно закрывается)
 */
function markOfflineBeacon(): void {
  try {
    const xsrf = readXsrfToken()
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      Accept: 'application/json',
    }
    if (xsrf) headers['X-XSRF-TOKEN'] = xsrf
    void fetch('/api/chat/offline', {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers,
    }).catch(() => {})
  } catch {
    // No-op: beacon необязателен.
  }
}

/**
 * Прочитать XSRF-TOKEN из кук для keepalive-beacon.
 *
 * @returns расшифрованное значение куки или null
 */
function readXsrfToken(): string | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/)
    if (!match) return null
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

function bindGlobalListeners() {
  if (listenersBound) return
  listenersBound = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { connect(); heartbeat() }
    else markOfflineBeacon()
  })
  window.addEventListener('beforeunload', () => { markOfflineBeacon(); disconnect() })
  window.addEventListener('pagehide', () => { markOfflineBeacon(); disconnect() })
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
