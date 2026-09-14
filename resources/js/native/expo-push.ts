import { api } from '@/services/api'

declare global {
  interface Window {
    UPinApp?: { expoPushToken?: string | null; pushPermission?: string; platform?: string }
    ReactNativeWebView?: { postMessage: (msg: string) => void }
  }
}

let bound: string | null = null
let attempts = 0

async function bind(token: string): Promise<void> {
  if (!token || token === bound) return
  bound = token
  try {
    await api.post('/api/expo-push-tokens', { token, platform: window.UPinApp?.platform ?? null })
  } catch {
    bound = null
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
    if (!window.ReactNativeWebView) return
    const t = current()
    if (t) {
      void bind(t)
    } else {
      requestToken()
      window.setTimeout(tick, 3000)
    }
    window.addEventListener('upin:push-token', (e) => {
      const token = (e as CustomEvent<{ token?: string }>).detail?.token
      if (token) void bind(token)
    })
  } catch {}
}
