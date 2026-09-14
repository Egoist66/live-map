import { api } from '@/services/api'

declare global {
  interface Window {
    UPinApp?: { expoPushToken?: string | null; pushPermission?: string; platform?: string }
    ReactNativeWebView?: { postMessage: (msg: string) => void }
  }
}

let bound: string | null = null
let attempts = 0
let listenersAttached = false

async function bind(token: string): Promise<void> {
  if (!token || token === bound) return
  try {
    await api.post('/api/expo-push-tokens', { token, platform: window.UPinApp?.platform ?? null })
    bound = token
  } catch (e: any) {
    // 401 = ещё не залогинен (SPA-логин позже инициализации): не фиксируем bound,
    // повторим при фокусе/смене аккаунта. Остальные ошибки — тоже ретраим ограниченно.
    bound = null
    if (e?.response?.status !== 401 && attempts < 12) window.setTimeout(tick, 5000)
  }
}

function current(): string | null {
  const t = window.UPinApp?.expoPushToken
  return typeof t === 'string' && t.startsWith('ExponentPushToken[') ? t : null
}

function requestToken(): void {
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'get-expo-push-token' }))
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
  if (attempts < 12) window.setTimeout(tick, 5000)
}

export function initExpoPushBinding(): void {
  try {
    // Только внутри нативного WebView — на чистом вебе выходим, ничего не меняем.
    if (!window.ReactNativeWebView) return
    const t = current()
    if (t) {
      void bind(t)
    } else {
      requestToken()
      window.setTimeout(tick, 3000)
    }
    if (!listenersAttached) {
      listenersAttached = true
      window.addEventListener('upin:push-token', (e) => {
        const token = (e as CustomEvent<{ token?: string }>).detail?.token
        if (token) void bind(token)
      })
      // Повторная привязка после SPA-логина/смены аккаунта: токен уже есть в WebView,
      // а сессии на момент init ещё не было (401). Веб-поведение не трогаем.
      window.addEventListener('focus', () => {
        const cur = current()
        if (cur && cur !== bound) void bind(cur)
      })
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return
        const cur = current()
        if (cur && cur !== bound) void bind(cur)
      })
      window.addEventListener('upin:auth-changed' as any, () => {
        bound = null
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
