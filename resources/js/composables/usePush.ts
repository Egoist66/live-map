import { onMounted, ref } from 'vue'
import { getSubscription, isSupported, permissionState, showLocal, subscribe, subscriptionPayload, unsubscribe } from '@/pwa/push.service'
import { removePushSubscription, savePushSubscription, sendTestPush } from '@/pwa/pwa.api'
import type { PushPermission } from '@/pwa/types'

const permission = ref<PushPermission>('default')
const subscribed = ref(false)
const loading = ref(false)
const supported = ref(false)
let inited = false

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
    try {
      const sub = await subscribe()
      if (!sub) {
        await refresh()
        return false
      }
      try {
        await savePushSubscription(subscriptionPayload(sub))
      } catch {}
      await refresh()
      return true
    } finally {
      loading.value = false
    }
  }

  async function disable(): Promise<void> {
    loading.value = true
    try {
      const sub = await getSubscription()
      if (sub) {
        try {
          await removePushSubscription(sub.endpoint)
        } catch {}
      }
      await unsubscribe()
      await refresh()
    } finally {
      loading.value = false
    }
  }

  async function toggle(): Promise<void> {
    if (subscribed.value) await disable()
    else await enable()
  }

  async function test(): Promise<void> {
    try {
      await sendTestPush()
    } catch {
      await showLocal('UPin', { body: 'Тестовое уведомление работает' })
    }
  }

  onMounted(() => init())

  return { supported, permission, subscribed, loading, init, refresh, enable, disable, toggle, test, notifyLocal: showLocal }
}
