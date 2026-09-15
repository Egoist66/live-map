import { APP_BADGE, APP_ICON, vapidPublicKey } from './pwa.config'
import { savePushSubscription } from './pwa.api'
import type { LocalNotifyOptions, PushPermission } from './types'

/**
 * Пейлоад пуша, пересланный сервис-воркером на сфокусированную страницу.
 * Серверный формат повторяет WebPushService: title/body/url/tag/avatar.
 */
export interface ForegroundPush {
  title?: string
  body?: string
  url?: string
  tag?: string
  avatar?: string | null
  icon?: string
}

function base64ToBytes(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator
}

export function permissionState(): PushPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function requestPermission(): Promise<PushPermission> {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return await Notification.requestPermission()
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function serverKeyOf(sub: PushSubscription): string | null {
  try {
    const raw = (sub.options as any)?.applicationServerKey as ArrayBuffer | null
    if (!raw) return null
    return bytesToBase64Url(new Uint8Array(raw))
  } catch {
    return null
  }
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  try {
    const existing = await navigator.serviceWorker.getRegistration('/')
    if (existing?.pushManager) return existing
    if (existing) return existing
  } catch {}
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    throw new Error('sw-register-failed')
  }
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!isSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration('/').catch(() => null)
  if (!reg?.pushManager) return null
  return await reg.pushManager.getSubscription().catch(() => null)
}

async function freshReregister(): Promise<ServiceWorkerRegistration> {
  return await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
    throw new Error('sw-register-failed')
  })
}

async function doSubscribe(reg: ServiceWorkerRegistration, key: string): Promise<PushSubscription> {
  const normalized = bytesToBase64Url(base64ToBytes(key))
  const existing = await reg.pushManager.getSubscription().catch(() => null)
  if (existing && serverKeyOf(existing) === normalized) return existing
  if (existing) {
    try {
      await existing.unsubscribe()
    } catch {}
  }
  return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) as unknown as BufferSource })
}

export async function subscribe(): Promise<PushSubscription> {
  if (!isSupported()) throw new Error('push-unsupported')
  const key = vapidPublicKey()
  if (!key) throw new Error('no-vapid-key')
  const permission = await requestPermission()
  if (permission !== 'granted') throw new Error(`permission-${permission}`)
  const reg = await readyRegistration()
  if (!reg.pushManager) throw new Error('push-unsupported')
  try {
    return await doSubscribe(reg, key)
  } catch (e: any) {
    try {
      const fresh = await freshReregister()
      if (!fresh.pushManager) throw e
      return await doSubscribe(fresh, key)
    } catch (e2: any) {
      throw new Error(`subscribe-failed:${e2?.message || e?.message || e2}`)
    }
  }
}

export async function unsubscribe(): Promise<boolean> {
  const sub = await getSubscription()
  if (!sub) return true
  return await sub.unsubscribe().catch(() => false)
}

export function subscriptionPayload(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } {
  const json = sub.toJSON()
  return { endpoint: sub.endpoint, keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' } }
}

export async function showLocal(title: string, options: LocalNotifyOptions = {}): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const { body, tag, url, avatar } = options
  const payload: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body: body ?? '',
    tag: tag ?? `local-${Date.now()}`,
    icon: avatar || APP_ICON,
    badge: APP_BADGE,
    vibrate: [120, 60, 120],
    renotify: true,
    data: url ? { url } : undefined,
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration('/')
    if (reg?.showNotification) {
      await reg.showNotification(title, payload)
      return
    }
  } catch {}
  try {
    new Notification(title, payload)
  } catch {}
}

/**
 * Подписка на пуши, пересланные SW сфокусированной странице.
 *
 * SW шлёт `upin-push`, когда окно в фокусе: системный баннер пропущен,
 * потому что realtime-шина (Echo) уже показала in-app тост. Событие —
 * страховка и точка расширения шины: страница решает, что делать с дублем.
 *
 * @param cb обработчик пересланного пейлоада
 * @returns функция отписки
 */
export function onForegroundPush(cb: (push: ForegroundPush) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {}
  }

  const handler = (event: MessageEvent) => {
    const data = (event as MessageEvent).data as { type?: string; push?: ForegroundPush } | null

    if (!data || data.type !== 'upin-push') {
      return
    }

    try {
      cb(data.push || {})
    } catch {}
  }

  navigator.serviceWorker.addEventListener('message', handler)

  return () => navigator.serviceWorker.removeEventListener('message', handler)
}

/**
 * Подписка на сигнал протухшей push-подписки (`pushsubscriptionchange`).
 *
 * @param cb обработчик сигнала — переподписаться и сохранить endpoint
 * @returns функция отписки
 */
export function onPushResubscribe(cb: () => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {}
  }

  const handler = (event: MessageEvent) => {
    const data = (event as MessageEvent).data as { type?: string } | null

    if (!data || data.type !== 'upin-push-resubscribe') {
      return
    }

    try {
      cb()
    } catch {}
  }

  navigator.serviceWorker.addEventListener('message', handler)

  return () => navigator.serviceWorker.removeEventListener('message', handler)
}

/**
 * Самолечение push-подписки: по сигналу SW тихо переподписаться
 * и сохранить свежий endpoint на сервере, чтобы пуши не переставали прилетать.
 */
async function healSubscription(): Promise<void> {
  try {
    if (permissionState() !== 'granted') {
      return
    }

    const sub = await subscribe()
    await savePushSubscription(subscriptionPayload(sub))
  } catch {}
}

/**
 * Глобальные push-мосты страницы: проброс foreground-пушей в шину
 * (`window` CustomEvent `upin:sw-push`) и самолечение подписки.
 * Вызывать один раз из точки входа приложения.
 *
 * @returns функция остановки мостов
 */
export function startPushBridges(): () => void {
  const offForeground = onForegroundPush((push) => {
    try {
      window.dispatchEvent(new CustomEvent<ForegroundPush>('upin:sw-push', { detail: push }))
    } catch {}
  })
  const offResubscribe = onPushResubscribe(() => {
    void healSubscription()
  })

  return () => {
    offForeground()
    offResubscribe()
  }
}
