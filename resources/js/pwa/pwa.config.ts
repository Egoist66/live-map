export const SW_URL = '/sw.js'

export const CACHE_PREFIXES = ['pwa-', 'workbox-precache']

// Стабильный URL: отдаёт иконку из админки или редиректит на дефолтную.
// Пуш-сервис получает актуальную иконку без пересборки фронта.
export const APP_ICON = '/branding/icon'
export const APP_BADGE = '/pwa-icon.svg?v=2'

export const vapidPublicKey = (): string =>
  document.querySelector<HTMLMetaElement>('meta[name="vapid-public-key"]')?.content ||
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ||
  ''
