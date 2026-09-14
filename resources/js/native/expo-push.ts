import { api } from '@/services/api'

declare global {
  interface Window {
    UPinApp?: { expoPushToken?: string | null; pushPermission?: string; platform?: string }
    UPin?: { expoPushToken?: string | null; platform?: string }
    expoPushToken?: string | null
    ReactNativeWebView?: { postMessage: (msg: string) => void }
  }
}

let bound: string | null = null
let attempts = 0
let listenersAttached = false
const MAX_ATTEMPTS = 40

/**
 * Мост WebView <-> upin-mobile для Expo-пушей.
 *
 * Мобилка инжектит токен в window.UPinApp.expoPushToken и/или отвечает
 * на postMessage {type:'get-expo-push-token'} токеном через CustomEvent
 * 'upin:push-token' либо document event 'message'. Здесь только чтение
 * токена и привязка к /api/expo-push-tokens, показ шторки — на мобилке.
 *
 * @example
 * import('./native/expo-push').then((m) => m.initExpoPushBinding())
 */
function isExpoToken(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const token = value.trim()
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
}

function pickToken(value: unknown): string | null {
  if (isExpoToken(value)) return (value as string).trim()
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    for (const key of ['token', 'expoPushToken', 'pushToken']) {
      if (isExpoToken(obj[key])) return (obj[key] as string).trim()
    }
  }
  return null
}

async function bind(token: string): Promise<void> {
  const clean = token.trim()
  if (!clean || clean === bound) return
  try {
    await api.post('/api/expo-push-tokens', { token: clean, platform: window.UPinApp?.platform ?? window.UPin?.platform ?? null })
    bound = clean
  } catch (e: any) {
    bound = null
    if (e?.response?.status !== 401 && attempts < MAX_ATTEMPTS) window.setTimeout(tick, 5000)
  }
}

function current(): string | null {
  const w = window as Window & Record<string, any>
  return (
    pickToken(w.UPinApp?.expoPushToken)
    ?? pickToken(w.UPin?.expoPushToken)
    ?? pickToken(w.expoPushToken)
    ?? pickToken(w.UPinApp)
    ?? pickToken(w.UPin)
    ?? null
  )
}

function requestToken(): void {
  try {
    const payload = JSON.stringify({ type: 'get-expo-push-token' })
    window.ReactNativeWebView?.postMessage(payload)
  } catch {}
  try {
    const legacy = JSON.stringify({ type: 'getExpoPushToken' })
    window.ReactNativeWebView?.postMessage(legacy)
  } catch {}
}

function tick(): void {
  const t = current()
  if (t) {
    void bind(t)
    return
  }
  attempts++
  requestToken()
  if (attempts < MAX_ATTEMPTS) window.setTimeout(tick, 3000)
}

function handleIncomingToken(raw: unknown): void {
  const token = pickToken(raw)
  if (token) {
    attempts = 0
    void bind(token)
  }
}

export function initExpoPushBinding(): void {
  try {
    if (!window.ReactNativeWebView && !current()) return
    const t = current()
    if (t) {
      void bind(t)
    } else {
      requestToken()
      window.setTimeout(tick, 3000)
    }
    if (!listenersAttached) {
      listenersAttached = true
      for (const name of ['upin:push-token', 'upin-push-token', 'expo-push-token', 'push-token']) {
        window.addEventListener(name, (e) => {
          const detail = (e as CustomEvent<unknown>).detail
          handleIncomingToken(detail ?? (e as CustomEvent<{ token?: string }>).detail?.token)
        })
      }
      document.addEventListener('message' as any, (e: any) => {
        handleIncomingToken(e?.data ?? e?.detail)
      })
      window.addEventListener('message' as any, (e: any) => {
        try {
          const data = typeof e?.data === 'string' ? JSON.parse(e.data) : e?.data
          handleIncomingToken(data?.token ?? data)
        } catch {
          handleIncomingToken(e?.data)
        }
      })
      window.addEventListener('focus', () => {
        const cur = current()
        if (cur && cur !== bound) void bind(cur)
        else if (!cur) requestToken()
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        const cur = current()
        if (cur && cur !== bound) void bind(cur)
        else if (!cur) requestToken()
      })
      window.addEventListener('online', () => {
        const cur = current()
        if (cur && cur !== bound) void bind(cur)
      })
      window.addEventListener('upin:auth-changed' as any, () => {
        bound = null
        attempts = 0
        const cur = current()
        if (cur) void bind(cur)
        else requestToken()
      })
    }
  } catch {}
}

/** Принудительно сбросить привязку (вызывать после logout/login, смены аккаунта). */
export function resetExpoPushBinding(): void {
  try {
    bound = null
    attempts = 0
    window.dispatchEvent(new CustomEvent('upin:auth-changed'))
  } catch {}
}
