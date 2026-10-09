import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { getStoredTokenSync } from '@/composables/useAuthStorage'

export { resetEchoSession } from '@/services/echo-session'

/**
 * Realtime-подключение к Reverb через laravel-echo.
 *
 * Модуль без сайд-эффектов при импорте: всё стартует через `initEcho()`
 * (клиент вызывает его из `useAppBoot` только для залогиненных).
 * Не импортировать статически из главного чанка: тянет
 * `laravel-echo` + `pusher-js` (~70 КБ) даже гостям. Для сброса сессии
 * есть лёгкий `@/services/echo-session` без тяжёлых зависимостей.
 */

let echoStarted = false

/**
 * Инициализирует realtime-соединение. На сервере (SSR) — no-op.
 *
 * Повторный вызов после смены аккаунта без перезагрузки (Inertia-логин)
 * не создаёт второй Echo, а переподключает существующий: иначе новый
 * аккаунт оставался без сокетов до жёсткого рефреша.
 */
export function initEcho(): void {
  if (typeof window === 'undefined') return
  if (echoStarted) {
    try {
      ;(window as any).Echo?.connect?.()
    } catch {}
    return
  }
  echoStarted = true

  // @ts-ignore
  window.Pusher = Pusher
  Pusher.logToConsole = false

  if (!rawKey) {
    console.warn('[reverb] VITE_REVERB_APP_KEY missing — Echo disabled, realtime off')
    // @ts-ignore
    window.Echo = null
    return
  }

  const params = resolveReverbParams()
  console.info('[reverb] connect', params.host, params.port, params.tls ? 'wss' : 'ws')
  // @ts-ignore
  window.Echo = new Echo({
    broadcaster: 'reverb',
    key: rawKey,
    wsHost: params.host,
    wsPort: params.port,
    wssPort: params.port,
    forceTLS: params.tls,
    enabledTransports: params.tls ? ['wss'] : ['ws'],
    disableStats: true,
    authEndpoint: resolveAuthEndpoint(),
    auth: { headers: resolveAuthHeaders() },
  })

  if ((window as any).Echo?.connector?.pusher) {
    const c = (window as any).Echo.connector.pusher.connection
    c.bind('error', (e: any) => console.warn('[reverb] error', e))
    c.bind('failed', () => console.warn('[reverb] failed'))
    c.bind('disconnected', () => console.warn('[reverb] disconnected'))
    c.bind('connected', () => console.info('[reverb] connected'))
  }

  try {
    if ((window as any).Echo) setupIdleDisconnect()
  } catch {}
}

/**
 * Резолвит параметры подключения к Reverb с фолбэком на same-origin.
 *
 * VITE_* запекаются в билд, поэтому на проде (Laravel Cloud, один порт 443
 * за прокси, nginx `location /app` -> Reverb) билд со значениями localhost
 * уводил бы сокет в никуда. Если запечённый хост loopback, а страница открыта
 * на реальном домене — подключаемся к хосту страницы.
 *
 * @returns параметры wsHost/wsPort/wssPort/forceTLS/transports
 */
function resolveReverbParams(): { host: string; port: number; tls: boolean } {
  const bakedHost = (import.meta.env.VITE_REVERB_HOST as string | undefined) || ''
  const bakedPort = Number(import.meta.env.VITE_REVERB_PORT || 0)
  const bakedScheme = (import.meta.env.VITE_REVERB_SCHEME as string | undefined) || ''
  const pageHost = window.location.hostname
  const pageTls = window.location.protocol === 'https:'
  const bakedIsLoopback = bakedHost === '' || bakedHost === 'localhost' || bakedHost === '127.0.0.1' || bakedHost === '0.0.0.0'
  const pageIsLoopback = pageHost === 'localhost' || pageHost === '127.0.0.1' || pageHost === '[::1]'
  const host = bakedIsLoopback && !pageIsLoopback ? pageHost : bakedHost || pageHost
  const tls = bakedScheme !== '' ? bakedScheme === 'https' : pageTls
  const fallbackPort = tls ? 443 : 80
  const port = bakedIsLoopback && !pageIsLoopback ? fallbackPort : bakedPort || fallbackPort
  return { host, port, tls }
}

const rawKey = import.meta.env.VITE_REVERB_APP_KEY
const apiOrigin = (import.meta.env.VITE_API_URL as string | undefined) || ''
function resolveAuthEndpoint(): string {
  if (apiOrigin) {
    const normalized = apiOrigin.endsWith('/') ? apiOrigin.slice(0, -1) : apiOrigin
    return `${normalized}/broadcasting/auth`
  }
  return '/broadcasting/auth'
}
function resolveAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' }
  const bearer = getStoredTokenSync()
  const hasBearer = bearer !== null && bearer !== ''
  if (hasBearer && bearer) {
    headers['Authorization'] = `Bearer ${bearer}`
  }
  return headers
}

/**
 * Освобождает WS-слот, пока вкладка не используется.
 *
 * Каждый открытый таб держит одно Reverb-соединение, и при упоре в
 * max_connections новые клиенты отбрасываются. Поэтому фоновая вкладка
 * (>60с hidden) и выгрузка страницы (pagehide) рвут сокет досрочно —
 * сервер иначе держал бы призрака до ping/activity таймаутов.
 * Возврат во вкладку переподключает сокет, pusher-js сам
 * переподписывает каналы, свежие данные дотягивает focus-resync в чате.
 */
function setupIdleDisconnect(): void {
  const idleDelay = 60_000
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  function echo(): any {
    return (window as any).Echo
  }
  function connect(): void {
    try {
      if (echo()?.connect) echo().connect()
    } catch {}
  }
  function disconnect(): void {
    try {
      if (echo()?.disconnect) echo().disconnect()
    } catch {}
  }
  function clearIdleTimer(): void {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = null
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearIdleTimer()
      idleTimer = setTimeout(disconnect, idleDelay)
    } else {
      clearIdleTimer()
      connect()
    }
  })
  window.addEventListener('pagehide', () => {
    clearIdleTimer()
    disconnect()
  })
  window.addEventListener('pageshow', (event) => {
    if ((event as PageTransitionEvent).persisted) connect()
  })
}
