import { onMounted, ref } from 'vue'
import { getSubscription, isSupported, permissionState, showLocal, subscribe, subscriptionPayload, unsubscribe } from '@/pwa/push.service'
import { removePushSubscription, savePushSubscription, sendTestPush } from '@/pwa/pwa.api'
import { currentAuthUid } from '@/composables/useAuthUid'
import type { PushPermission } from '@/pwa/types'

const permission = ref<PushPermission>('default')
const subscribed = ref(false)
const loading = ref(false)
const supported = ref(false)
const pushError = ref<string | null>(null)
let inited = false

function describeError(e: any): string {
  const code = typeof e?.message === 'string' ? e.message : String(e || '')
  if (code === 'push-unsupported') return 'Браузер не поддерживает пуши: нужен Chrome/Edge на Android по HTTPS или установленная PWA'
  if (code === 'no-vapid-key') return 'Нет VAPID-ключа: проверь настройки сервера'
  if (code === 'permission-denied') return 'Уведомления заблокированы в настройках браузера/телефона'
  if (code === 'permission-default') return 'Разрешение на уведомления не дано'
  if (code === 'sw-register-failed') return 'Service Worker не запустился: открой собранную версию по HTTPS (не dev-режим)'
  if (code.startsWith('subscribe-failed:')) {
    const raw = code.slice(17)
    if (/push service/i.test(raw)) return 'Push-сервис Chrome отклонил регистрацию (битое состояние браузера). Попробуй: Настройки Chrome → Конфиденциальность → Данные сайтов → удали данные этого сайта → обнови страницу → Вкл'
    return `Не удалось подписаться: ${raw}`
  }
  if (e?.response?.status === 419 || e?.response?.status === 401) return 'Не сохранилось на сервере: обнови страницу и войди заново'
  return 'Не удалось включить уведомления, попробуй ещё раз'
}

async function refresh(): Promise<void> {
  supported.value = isSupported()
  permission.value = permissionState()
  try {
    subscribed.value = (await getSubscription()) !== null
  } catch {
    subscribed.value = false
  }
}

function currentUid(): number {
  try {
    const cached = currentAuthUid()
    if (cached > 0) return cached
    const inertiaUid = Number((window as any)?.__inertia_page?.props?.auth?.user?.id || 0)
    if (inertiaUid) return inertiaUid
    const meta = document.querySelector('meta[name="user-id"]')?.getAttribute('content')
    if (meta) return Number(meta)
    return Number((window as any).userId || 0)
  } catch { return 0 }
}

async function syncBinding(): Promise<void> {
  try {
    if (!currentUid()) return
    if (permission.value !== 'granted') return
    const sub = await getSubscription()
    if (!sub) return
    await savePushSubscription(subscriptionPayload(sub))
    subscribed.value = true
  } catch {}
}

export function usePush() {
  async function init(): Promise<void> {
    if (inited) {
      await refresh()
      await syncBinding()
      return
    }
    inited = true
    await refresh()
    await syncBinding()
  }

  async function enable(): Promise<boolean> {
    if (loading.value) return subscribed.value
    loading.value = true
    pushError.value = null
    try {
      let sub
      try {
        sub = await subscribe()
      } catch (e) {
        pushError.value = describeError(e)
        await refresh()
        return false
      }
      try {
        await savePushSubscription(subscriptionPayload(sub))
      } catch (e) {
        pushError.value = describeError(e)
      }
      await refresh()
      return pushError.value === null
    } finally {
      loading.value = false
    }
  }

  async function disable(): Promise<boolean> {
    loading.value = true
    pushError.value = null
    try {
      const sub = await getSubscription()
      if (sub) {
        try {
          await removePushSubscription(sub.endpoint)
        } catch (e) {
          pushError.value = describeError(e)
        }
      }
      const ok = await unsubscribe().catch(() => false)
      if (!ok) pushError.value = pushError.value || 'Не удалось отписаться, попробуй ещё раз'
      await refresh()
      return pushError.value === null
    } finally {
      loading.value = false
    }
  }

  async function toggle(): Promise<boolean> {
    if (subscribed.value) return await disable()
    return await enable()
  }

  async function test(): Promise<void> {
    try {
      await sendTestPush()
    } catch {
      await showLocal('ULove', { body: 'Тестовое уведомление работает' })
    }
  }

  onMounted(() => init())

  return { supported, permission, subscribed, loading, pushError, init, refresh, enable, disable, toggle, test, notifyLocal: showLocal }
}
