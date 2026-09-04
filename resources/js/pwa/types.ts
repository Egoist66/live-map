export type PwaDisplayMode = 'browser' | 'standalone' | 'minimal-ui' | 'fullscreen' | 'picture-in-picture'

export type SwUpdateHandler = (registration: ServiceWorkerRegistration) => void

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type PushPermission = NotificationPermission | 'unsupported'

export interface SaveSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
  encoding?: string
}

export interface LocalNotifyOptions {
  body?: string
  tag?: string
  url?: string
  avatar?: string | null
}
