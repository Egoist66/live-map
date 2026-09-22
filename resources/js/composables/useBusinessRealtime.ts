import { onMounted } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { busOn } from '@/services/realtime-bus'
import { useBusinessStore } from '@/stores/business'
import { useRealtimeMode } from '@/composables/useRealtimeMode'
import { useRealtimePoller, watchRealtimeMode } from '@/composables/useRealtimePoller'
import type { BusinessProfile } from '@/types/entities/Business'

type EchoLike = {
  private: (channel: string) => { listen: (event: string, cb: (payload: never) => void) => unknown }
}

let busBound = false
let socketBoundUid = 0
let pollerStarted = false

/**
 * Живой статус проверки в кабинете бизнеса.
 *
 * Разрыв был такой: кабинет не слушал вообще ничего — ни сокет
 * `.business.verified/rejected` в `user.{id}` (подписка жила только
 * в `useBusinessProfile.bindRealtime`, который никто не вызывал),
 * ни шину `business:status` из поллера (сам поллер в кабинете
 * не стартовал). Уведомление прилетало inbox'ом, а
 * `store.profile.verification_status` оставался «на проверке».
 *
 * Хук чинит все три пути разом: шина → стор, сокет → стор,
 * поллер + мгновенный `refreshDashboard()` на монтировании.
 * Тосты оставлены системе уведомлений (inbox), чтобы не двоить.
 *
 * Подключается один раз в `BusinessLayout` — покрывает все
 * страницы кабинета (`Index/Pins/Onboarding/Settings`).
 *
 * @returns init для ручного запуска
 * @example
 * const bizRealtime = useBusinessRealtime() // сам стартует на mounted
 */
export function useBusinessRealtime() {
  const store = useBusinessStore()
  const realtimeMode = useRealtimeMode()
  const realtimePoller = useRealtimePoller()

  /**
   * Тихо применить свежий профиль из события в стор.
   *
   * Без тостов: о проверке/отказе сообщает inbox-уведомление,
   * иначе тост двоился бы (сокет/шина + inbox).
   *
   * @param payload событие с полем business
   */
  function applyBusiness(payload: unknown): void {
    const business = (payload as { business?: BusinessProfile } | null)?.business
    if (!business || typeof business !== 'object') {
      return
    }
    try {
      store.applyRealtime(business)
    } catch {}
  }

  /**
   * Id владельца из auth-пропсов страницы.
   * @returns числовой id или 0
   */
  function authUid(): number {
    try {
      const authUser = (usePage().props.auth as { user?: { id?: number } } | undefined)?.user
      return Number(authUser?.id ?? 0) || 0
    } catch {
      return 0
    }
  }

  /**
   * Подписать шину на смену статуса (синглтон).
   */
  function ensureBus(): void {
    if (busBound) {
      return
    }
    busBound = true
    busOn('business:status', applyBusiness)
    busOn('user:business.verified', applyBusiness)
    busOn('user:business.rejected', applyBusiness)
  }

  /**
   * Слушать сокет private `user.{uid}` (синглтон на владельца).
   * @param uid id владельца кабинета
   */
  function ensureSocket(uid: number): void {
    if (!uid || socketBoundUid === uid) {
      return
    }
    socketBoundUid = uid
    const tryBind = (): void => {
      const echo = (window as unknown as { Echo?: EchoLike }).Echo
      if (!echo) {
        window.setTimeout(tryBind, 2500)
        return
      }
      try {
        echo.private(`user.${uid}`).listen('.business.verified', applyBusiness as (payload: never) => void)
        echo.private(`user.${uid}`).listen('.business.rejected', applyBusiness as (payload: never) => void)
      } catch {}
    }
    tryBind()
  }

  /**
   * Запустить realtime-поллер кабинета (синглтон).
   */
  async function ensurePoller(): Promise<void> {
    if (pollerStarted) {
      return
    }
    pollerStarted = true
    try {
      watchRealtimeMode((next) => realtimePoller.ensure(next))
      const current = await realtimeMode.init()
      realtimePoller.ensure(current)
    } catch {}
  }

  /**
   * Полный запуск: шина + сокет + поллер + свежий дашборд сразу.
   */
  async function init(): Promise<void> {
    ensureBus()
    ensureSocket(authUid())
    await ensurePoller()
    try {
      await store.refreshDashboard()
    } catch {}
  }

  onMounted(() => {
    void init()
  })

  return { init }
}
