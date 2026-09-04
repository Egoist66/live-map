import { APP_BADGE, APP_ICON, vapidPublicKey } from './pwa.config'
import type { LocalNotifyOptions, PushPermission } from './types'

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

export async function subscribe(): Promise<PushSubscription> {
  if (!isSupported()) throw new Error('push-unsupported')
  const key = vapidPublicKey()
  if (!key) throw new Error('no-vapid-key')
  const permission = await requestPermission()
  if (permission !== 'granted') throw new Error(`permission-${permission}`)
  const reg = await readyRegistration()
  if (!reg.pushManager) throw new Error('push-unsupported')
  const normalized = bytesToBase64Url(base64ToBytes(key))
  const existing = await reg.pushManager.getSubscription().catch(() => null)
  if (existing && serverKeyOf(existing) === normalized) return existing
  if (existing) {
    try {
      await existing.unsubscribe()
    } catch {}
  }
  try {
    return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) as unknown as BufferSource })
  } catch (e: any) {
    throw new Error(`subscribe-failed:${e?.message || e}`)
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
  const payload: NotificationOptions & { vibrate?: number[] } = {
    body: body ?? '',
    tag: tag ?? `local-${Date.now()}`,
    icon: avatar || APP_ICON,
    badge: APP_BADGE,
    vibrate: [120, 60, 120],
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
