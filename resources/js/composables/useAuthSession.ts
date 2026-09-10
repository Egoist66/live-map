import { onMounted, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { resetChatSession } from '@/composables/useChat'
import { resetAppNotifications } from '@/composables/useAppNotifications'
import { resetPresence } from '@/composables/usePresence'
import { useBadgeStore } from '@/stores/badges'
import { resetEchoSession } from '@/echo'

const trackedUid = ref<number | null>(null)
let watching = false

function currentAuthUid(): number | null {
  try {
    const id = Number((usePage().props.auth as any)?.user?.id || 0)
    return id || null
  } catch {
    return null
  }
}

/**
 * Следит за сменой аккаунта и сбрасывает realtime-подписки.
 *
 * Чинит баг: вышел из A, зашёл в B — секунду прилетает тост из A,
 * клик ведёт в чужой /chat/{id} и падает с 403.
 * Причина — Echo user.A оставался подписан после Inertia-логина.
 *
 * @returns текущий uid аккаунта
 */
export function useAuthSession() {
  function resetAll(): void {
    try {
      resetChatSession()
    } catch {}
    try {
      resetAppNotifications()
    } catch {}
    try {
      resetPresence()
    } catch {}
    try {
      useBadgeStore().reset()
    } catch {}
    try {
      resetEchoSession([])
    } catch {}
  }

  function syncUid(): void {
    const uid = currentAuthUid()
    if (trackedUid.value !== null && uid !== trackedUid.value) {
      resetAll()
    }
    trackedUid.value = uid
  }

  onMounted(() => {
    trackedUid.value = currentAuthUid()
    if (watching) {
      return
    }
    watching = true
    watch(
      () => {
        try {
          return (usePage().props.auth as any)?.user?.id ?? null
        } catch {
          return null
        }
      },
      () => syncUid(),
    )
  })

  return { trackedUid, syncUid, resetAll }
}
