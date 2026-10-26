import { ref, computed, onMounted } from 'vue'
import { chatApi } from '@/services/chat.api'
import { busOn } from '@/services/realtime-bus'

const onlineIds = ref<Set<number>>(new Set())
/** Свежий last_seen у собеседников со среза поллинга (presence-канал в polling-режиме мёртв). */
const seenPresenceAt = new Map<number, number>()
/** TTL записи seeing-среза: совпадает с порогом онлайн (User::isAway — 3 минуты). */
const PRESENCE_SEEN_TTL_MS = 180000
let channel: any = null
let started = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryAttempts = 0
const MAX_RETRY_ATTEMPTS = 10
let beatTimer: ReturnType<typeof setInterval> | null = null
let listenersBound = false
let pollingBound = false

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
 * Единая система онлайна для веба, десктопа, PWA и бота: источник правды —
 * только last_seen_at с порогом 3 минуты (см. User::isAway). Пингуем и в фоне
 * (свёрнутая вкладка, потеря фокуса): человек остаётся онлайн, пока приложение
 * открыто. Пинг прекращается только при реальном закрытии — дальше работают
 * 3 минуты грейса, одинаковые везде.
 */
function heartbeat() {
  if (isInvisible()) return
  chatApi.heartbeat().catch(() => {})
}

function ensureHeartbeat() {
  if (beatTimer) return
  heartbeat()
  beatTimer = setInterval(heartbeat, 45000)
}

/**
 * Сказать бэку «Mini App закрыт» даже когда страница уже умирает.
 *
 * Обычный axios на pagehide не успевает (страница выгружена), поэтому шлём
 * fetch с keepalive + куками сессии + XSRF из куки: Laravel примет POST
 * без 419. Бэк last_seen_at НЕ трогает — человек остаётся онлайн ещё
 * 3 минуты грейса везде (веб, десктоп, PWA, бот), а пропущенные сообщения
 * досылаются в Telegram-бота через flushUnread + отложенную задачу.
 *
 * Потеря фокуса / скрытие вкладки — НЕ закрытие: бикон там не шлём,
 * heartbeat продолжает пинговать в фоне.
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
  bindPollingPresence()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { connect(); heartbeat() }
  })
  window.addEventListener('beforeunload', () => { markOfflineBeacon(); disconnect() })
  window.addEventListener('pagehide', () => { markOfflineBeacon(); disconnect() })
}

/**
 * Разовая подписка на online-срез поллинга (`user:presence.seen`).
 *
 * В polling-режиме presence-канал Echo недоступен, поэтому состав
 * «кто онлайн» собирает сервер: свежий last_seen у участников моих
 * диалогов. Мерджим в seen-карту с TTL — как в ВК: активный горит
 * зелёным без ожидания нового сообщения, молчал 3 минуты — офлайн.
 */
function bindPollingPresence(): void {
  if (pollingBound) return
  pollingBound = true
  try {
    busOn('user:presence.seen', (e: { user_ids?: number[] } | null) => {
      const ids = Array.isArray(e?.user_ids) ? e.user_ids : []
      if (ids.length === 0) return
      const now = Date.now()
      for (const raw of ids) {
        const id = Number(raw)
        if (!(id > 0)) continue
        seenPresenceAt.set(id, now)
      }
      // Прореживаем протухшие записи, чтобы карта не росла без предела.
      if (seenPresenceAt.size > 500) {
        for (const [id, at] of seenPresenceAt) {
          if (now - at > PRESENCE_SEEN_TTL_MS) seenPresenceAt.delete(id)
        }
      }
    })
  } catch {
    pollingBound = false
  }
}

/**
 * Онлайн по seen-срезу: запись свежая и не тлела дольше порога.
 *
 * @param id id пользователя
 * @returns true когда срез поллинга видел его недавно
 */
function isSeenOnline(id: number): boolean {
  const at = seenPresenceAt.get(id)
  if (at === undefined) return false
  return Date.now() - at < PRESENCE_SEEN_TTL_MS
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
  seenPresenceAt.clear()
  selfInvisible.value = false
}

export function isOnlineWithFallback(id: number | string | null | undefined, lastSeenAt?: string | null): boolean {
  if (id == null) return false
  const nid = Number(id)
  if (onlineIds.value.has(nid) || isSeenOnline(nid)) return true
  return isRecentlySeen(lastSeenAt)
}

export function usePresence() {
  onMounted(() => connect())

  const isOnline = (id: number | string | null | undefined, lastSeenAt?: string | null) => {
    if (id == null) return false
    const nid = Number(id)
    if (onlineIds.value.has(nid) || isSeenOnline(nid)) return true
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
      const nid = Number(id)
      if (onlineIds.value.has(nid) || isSeenOnline(nid)) return true
      return isRecentlySeen(lastSeenAt)
    },
    connect,
    disconnect,
  }
}
