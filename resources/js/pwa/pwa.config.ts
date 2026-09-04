export const SW_URL = '/sw.js'

export const CACHE_PREFIXES = ['pwa-', 'workbox-precache']

export const APP_ICON = '/pwa-192x192.png'
export const APP_BADGE = '/pwa-icon.svg'

export const vapidPublicKey = (): string =>
  document.querySelector<HTMLMetaElement>('meta[name="vapid-public-key"]')?.content ||
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ||
  ''
