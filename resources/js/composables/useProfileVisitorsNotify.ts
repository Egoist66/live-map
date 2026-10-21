import { computed, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { profileStatsApi } from '@/services/profileStats.api'
import { planOf } from '@/composables/usePlanLimits'

/**
 * Тумблер «Кто заходил в мой профиль» в приватности ULove.
 *
 * PRO и выше: при визите гостя прилетает колокольчик
 * (realtime + пуш) и письмо Telegram-бота. На Premium —
 * то же самое, плюс список гостей с анкетами в статистике.
 * Free тумблер видит, но включить не может (403 с бэка).
 *
 * @returns состояние тумблера, гейт тарифа и сохранение
 * @example
 * const visitors = useProfileVisitorsNotify()
 */
export function useProfileVisitorsNotify() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)

  const state = ref({
    enabled: (authUser.value?.notify_profile_visitors ?? true) as boolean,
    saving: false,
    error: null as string | null,
  })

  /** Действующий тариф для гейта. */
  const plan = computed(() => String(authUser.value?.effective_plan || authUser.value?.plan || 'free'))

  /** Подпись тарифа для плашек. */
  const planLabel = computed(() => {
    if (plan.value === 'business') return 'Business'
    if (plan.value === 'premium') return 'Premium'
    if (plan.value === 'pro') return 'PRO'
    return 'Free'
  })

  /** Тумблер доступен на платном тарифе или стаффу. */
  const canUse = computed(() => {
    const user = authUser.value
    if (!user) return false
    if (user.is_admin || user.role === 'admin' || user.role === 'moderator') return true
    return ['pro', 'premium', 'business'].includes(planOf(user))
  })

  /** Текст статуса под названием. */
  const statusText = computed(() => {
    if (!canUse.value) return 'Только на PRO и выше'
    return state.value.enabled
      ? 'Включено: гости падают в колокольчик и в бота'
      : 'Выключено: визиты только копятся в статистике'
  })

  /**
   * Сохранить тумблер с откатом при ошибке.
   *
   * @param next новое значение
   */
  async function save(next: boolean): Promise<void> {
    if (!canUse.value || state.value.saving) {
      return
    }

    const prev = state.value.enabled
    state.value.enabled = next
    state.value.error = null
    state.value.saving = true

    try {
      const data = await profileStatsApi.updatePreferences(next)
      state.value.enabled = data.notify_profile_visitors
      try {
        if (authUser.value) authUser.value.notify_profile_visitors = state.value.enabled
        const w = window as any
        if (w.__inertia_page?.props?.auth?.user) w.__inertia_page.props.auth.user.notify_profile_visitors = state.value.enabled
        if ((document as any).__page_auth_user) (document as any).__page_auth_user.notify_profile_visitors = state.value.enabled
      } catch {}
    } catch {
      state.value.enabled = prev
      state.value.error = 'Не удалось сохранить — попробуй ещё раз'
    } finally {
      state.value.saving = false
    }
  }

  /**
   * Stale props: при навигации по history-кэшу Inertia может
   * вернуть старый auth.user — пересинхронизируем, не мешая
   * откату в момент своего сохранения.
   */
  watch(authUser, (u) => {
    if (!state.value.saving) {
      state.value.enabled = !!(u?.notify_profile_visitors ?? true)
    }
  })

  return { state, plan, planLabel, canUse, statusText, save }
}
