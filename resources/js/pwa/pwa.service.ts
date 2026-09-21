import { SW_URL } from './pwa.config'
import type { BeforeInstallPromptEvent, PwaDisplayMode, SwUpdateHandler } from './types'

let registration: ServiceWorkerRegistration | null = null
let registerPromise: Promise<ServiceWorkerRegistration | null> | null = null
let skipWaitingRefresh = false
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (skipWaitingRefresh) {
        skipWaitingRefresh = false
        window.location.reload()
      }
    })
  }
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

/**
 * Регистрирует service worker оболочки.
 *
 * В dev (Vite HMR) регистрация запрещена: `public/sw.js` — артефакт
 * последнего продакшен-билда, в dev он перехватывает навигации,
 * тянет несуществующий `/build/*` (404 в precache) и мешает
 * восстановлению после 504 холодного transform. Пуши в dev ходят
 * через явный флоу подписки, а не через авторегистрацию.
 *
 * Вызовы из `app.ts` и `usePwa.init()` идут почти одновременно после mount:
 * без общего in-flight промиса оба видят `registration === null` и делают
 * параллельный `register('/sw.js')` с двойными `updatefound`-подписками.
 * Общий промис гарантирует одну регистрацию на страницу.
 *
 * @returns регистрация SW или null когда API недоступен / dev-режим
 */
export async function register(): Promise<ServiceWorkerRegistration | null> {
  bindOnce()
  if (!isSupported()) {
    return null
  }
  if (import.meta.env.DEV) {
    void evictDevWorkers()
    return null
  }
  if (registration) {
    return registration
  }
  if (!registerPromise) {
    registerPromise = performRegister().finally(() => {
      registerPromise = null
    })
  }
  return registerPromise
}

/**
 * Выгнать протувший прод-SW из dev-вкладки (один раз за сессию).
 *
 * `public/sw.js` от прошлого билда перехватывает навигации dev,
 * отдаёт старые бандлы без свежего кода и тянет 404 precache —
 * из-за него звонки/фиксы «не доходят» хотя код уже на месте.
 * В проде не вызывается (guard выше по import.meta.env.DEV).
 */
async function evictDevWorkers(): Promise<void> {
  try {
    if (sessionStorage.getItem('upin:sw-evict-dev')) return
    sessionStorage.setItem('upin:sw-evict-dev', '1')
  } catch {}
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.map((reg) => reg.unregister().catch(() => false)))
  } catch {}
  try {
    const keys = await caches.keys()
    const stale = keys.filter((key) => key.startsWith('pwa-') || key.startsWith('workbox-'))
    await Promise.all(stale.map((key) => caches.delete(key).catch(() => false)))
  } catch {}
}

/**
 * Одна попытка регистрации с подпиской на обновления.
 *
 * @returns регистрация SW или null при ошибке (повтор разрешён)
 */
async function performRegister(): Promise<ServiceWorkerRegistration | null> {
  let current: ServiceWorkerRegistration | null = null
  try {
    current = await navigator.serviceWorker.register(SW_URL, { scope: '/' })
  } catch {
    return null
  }
  registration = current
  if (current.waiting) {
    updateHandler?.(current)
  }
  current.addEventListener('updatefound', () => {
    const worker = registration?.installing
    if (!worker) {
      return
    }
    worker.addEventListener('statechange', () => {
      const hasController = !!navigator.serviceWorker.controller
      if (worker.state === 'installed' && hasController) {
        updateHandler?.(registration as ServiceWorkerRegistration)
      }
    })
  })
  return current
}

/**
 * Применить обновление SW: разбудить waiting-воркер и перезагрузиться.
 *
 * Всегда заканчивается перезагрузкой: по `controllerchange` после
 * `SKIP_WAITING`, а если SW сообщение не обработал — по таймауту.
 * Кнопка «Обновить» не бывает холостой.
 */
export async function applyUpdate(): Promise<void> {
  const reg = registration ?? (await navigator.serviceWorker?.getRegistration('/').catch(() => null))
  const waiting = reg?.waiting
  if (waiting) {
    skipWaitingRefresh = true
    waiting.postMessage({ type: 'SKIP_WAITING' })
    window.setTimeout(() => {
      if (skipWaitingRefresh) {
        skipWaitingRefresh = false
        window.location.reload()
      }
    }, 2500)
    return
  }
  window.location.reload()
}

export function getRegistration(): ServiceWorkerRegistration | null {
  return registration
}

// Слушаем beforeinstallprompt как можно раньше: браузер присылает
// событие в начале загрузки страницы, до монтирования Vue.
// Поздняя подписка (в onMounted) его пропускает — и кнопка
// «Установить» вместо системного промпта показывает инструкцию.
bindOnce()
