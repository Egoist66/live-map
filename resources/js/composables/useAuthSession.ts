import { onMounted, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { resetChatSession } from '@/composables/useChat'
import { resetAppNotifications } from '@/composables/useAppNotifications'
import { resetPresence } from '@/composables/usePresence'
import { resetPinActivity } from '@/composables/usePinActivity'
import { resetAdminReports } from '@/composables/useAdminReports'
import { resetSecurityImpersonations } from '@/composables/useSecurityImpersonations'
import { resetScreenLockSession, useScreenLock } from '@/composables/useScreenLock'
import { useBadgeStore } from '@/stores/badges'
import { resetEchoSession } from '@/services/echo-session'
import { stopRealtimePoller } from '@/composables/useRealtimePoller'

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
      resetPinActivity()
    } catch {}
    try {
      resetAdminReports()
    } catch {}
    try {
      resetSecurityImpersonations()
    } catch {}
    try {
      resetScreenLockSession()
    } catch {}
    try {
      useBadgeStore().reset()
    } catch {}
    try {
      resetEchoSession([])
    } catch {}
    try {
      stopRealtimePoller()
    } catch {}
  }

  function syncUid(): void {
    const uid = currentAuthUid()
    const prevUid = trackedUid.value
    const isAccountChanged = prevUid !== null && uid !== prevUid
    if (isAccountChanged) {
      resetAll()
    }
    trackedUid.value = uid
    const isLoggedInAsOther = isAccountChanged && uid !== null
    if (isLoggedInAsOther) {
      void reloadScreenLockForNewAccount()
      void reconnectRealtimeForNewAccount()
    }
  }

  /**
   * Переподключить realtime после Inertia-логина без перезагрузки.
   *
   * Лейаут персистентный: mount не повторяется, поэтому bootRealtime
   * и initRealtime из useAppLayout заново не бегут. Без этого новый
   * аккаунт сидел бы без сокетов/user-канала/поллера до рефреша.
   * Динамические импорты — чтобы лёгкий модуль не тащил echo в главный чанк.
   */
  async function reconnectRealtimeForNewAccount(): Promise<void> {
    try {
      const echo = await import('@/echo')
      echo.initEcho()
    } catch {}
    try {
      const { ensureUserChannel } = await import('@/composables/useUserChannel')
      ensureUserChannel()
    } catch {}
    try {
      const [{ useRealtimeMode }, { useRealtimePoller }] = await Promise.all([
        import('@/composables/useRealtimeMode'),
        import('@/composables/useRealtimePoller'),
      ])
      const current = await useRealtimeMode().init()
      useRealtimePoller().ensure(current)
    } catch {}
  }

  /**
   * Подтягивает скринлок нового аккаунта после смены юзера.
   *
   * Без этого layout остаётся смонтированным (Inertia без перезагрузки),
   * init() повторно не вызывается и висит старый enabled=true от юзера A.
   */
  async function reloadScreenLockForNewAccount(): Promise<void> {
    try {
      await useScreenLock().load()
    } catch {}
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
