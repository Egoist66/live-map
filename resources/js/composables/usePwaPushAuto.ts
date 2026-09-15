import { onMounted } from 'vue'
import { getSubscription, isSupported, permissionState, requestPermission, subscribe, subscriptionPayload } from '@/pwa/push.service'
import { isStandalone } from '@/pwa/pwa.service'
import { savePushSubscription } from '@/pwa/pwa.api'

/**
 * Автоподписка Web Push в установленном PWA.
 *
 * Закрытая PWA не держит ни сокет Echo, ни поллер — единственным каналом
 * доставки остаётся серверный web-push, а он требует подписку на устройстве.
 * Тумблер в настройках включают единицы, поэтому standalone-приложение
 * оформляет подписку само при запуске: тихо, если разрешение уже дано,
 * и с однократным системным запросом, если ещё не спрашивали.
 *
 * @example
 * ```ts
 * usePwaPushAuto()
 * ```
 */
const ASKED_KEY = 'upin:pwa-push-asked'

function currentUid(): number {
  try {
    const inertiaUid = Number((window as unknown as { __inertia_page?: { props?: { auth?: { user?: { id?: number } } } } })?.__inertia_page?.props?.auth?.user?.id || 0)
    if (inertiaUid) {
      return inertiaUid
    }
  } catch {}
  return 0
}

function alreadyAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === '1'
  } catch {
    return true
  }
}

function markAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, '1')
  } catch {}
}

/**
 * Оформить и привязать push-подписку к текущему пользователю.
 *
 * Подписка без привязки бесполезна: серверный пуш не знает адресата,
 * поэтому endpoint всегда сохраняется через `savePushSubscription`.
 */
export async function ensurePwaPushSubscription(): Promise<void> {
  try {
    if (!isStandalone() || !isSupported()) {
      return
    }
    if (!currentUid()) {
      return
    }
    const existing = await getSubscription().catch(() => null)
    if (existing) {
      await savePushSubscription(subscriptionPayload(existing)).catch(() => {})
      return
    }
    const state = permissionState()
    if (state === 'denied' || state === 'unsupported') {
      return
    }
    if (state === 'default') {
      if (alreadyAsked()) {
        return
      }
      const next = await requestPermission()
      markAsked()
      if (next !== 'granted') {
        return
      }
    }
    const created = await subscribe()
    await savePushSubscription(subscriptionPayload(created)).catch(() => {})
  } catch {}
}

/**
 * Хук автоподписки: запускает проверку один раз при монтировании layout.
 *
 * @returns метод ручного перезапуска проверки
 */
export function usePwaPushAuto() {
  onMounted(() => {
    void ensurePwaPushSubscription()
  })

  return { ensurePwaPushSubscription }
}
