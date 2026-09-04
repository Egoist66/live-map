import { SW_URL } from './pwa.config'
import type { BeforeInstallPromptEvent, PwaDisplayMode, SwUpdateHandler } from './types'

let registration: ServiceWorkerRegistration | null = null
let deferredPrompt: BeforeInstallPromptEvent | null = null
let updateHandler: SwUpdateHandler | null = null
let promptListeners: Array<() => void> = []
let onlineListeners: Array<(online: boolean) => void> = []
let bound = false

export function isSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator
}

function bindOnce(): void {
  if (bound || typeof window === 'undefined') return
  bound = true
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    promptListeners.forEach((cb) => cb())
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    promptListeners.forEach((cb) => cb())
  })
  window.addEventListener('online', () => onlineListeners.forEach((cb) => cb(true)))
  window.addEventListener('offline', () => onlineListeners.forEach((cb) => cb(false)))
}

export function onInstallChange(cb: () => void): () => void {
  promptListeners.push(cb)
  return () => {
    promptListeners = promptListeners.filter((x) => x !== cb)
  }
}

export function onOnlineChange(cb: (online: boolean) => void): () => void {
  onlineListeners.push(cb)
  return () => {
    onlineListeners = onlineListeners.filter((x) => x !== cb)
  }
}

export function onUpdate(cb: SwUpdateHandler): void {
  updateHandler = cb
}

export function canInstall(): boolean {
  return deferredPrompt !== null
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  await deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  promptListeners.forEach((cb) => cb())
  return outcome
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}

export function getDisplayMode(): PwaDisplayMode {
  if (typeof window === 'undefined') return 'browser'
  if (window.matchMedia('(display-mode: fullscreen)').matches) return 'fullscreen'
  if (window.matchMedia('(display-mode: standalone)').matches) return 'standalone'
  if (window.matchMedia('(display-mode: minimal-ui)').matches) return 'minimal-ui'
  if (window.matchMedia('(display-mode: picture-in-picture)').matches) return 'picture-in-picture'
  return 'browser'
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export async function register(): Promise<ServiceWorkerRegistration | null> {
  bindOnce()
  if (!isSupported()) return null
  if (registration) return registration
  try {
    registration = await navigator.serviceWorker.register(SW_URL, { scope: '/' })
    if (registration.waiting) updateHandler?.(registration)
    registration.addEventListener('updatefound', () => {
      const worker = registration?.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          updateHandler?.(registration as ServiceWorkerRegistration)
        }
      })
    })
    return registration
  } catch {
    return null
  }
}

export async function applyUpdate(): Promise<void> {
  const reg = registration ?? (await navigator.serviceWorker?.getRegistration('/').catch(() => null))
  const waiting = reg?.waiting
  if (waiting) {
    waiting.postMessage({ type: 'SKIP_WAITING' })
    return
  }
  window.location.reload()
}

export function getRegistration(): ServiceWorkerRegistration | null {
  return registration
}
