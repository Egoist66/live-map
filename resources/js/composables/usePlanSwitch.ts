import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { subscriptionApi } from '@/services/subscription.api'
import { planOf } from '@/composables/usePlanLimits'
import type { PlanId } from '@/composables/usePlanDetails'

/**
 * Короткая подпись тарифа для карточек выбора.
 */
export interface PlanCardMeta {
  /** идентификатор тарифа */
  id: PlanId
  /** название */
  name: string
  /** цена */
  price: string
  /** короткое описание лимитов */
  summary: string
}

/**
 * Смена тарифа всего приложения из таба «Тариф».
 *
 * Тарифы — сквозная сущность, а не настройка профиля или отдельного
 * модуля: переключение идёт через Subscription API (renew/cancel),
 * вступает сразу, страница подтягивает свежий `auth` без перезагрузки.
 * Free — откат подписки, Pro/Business — продление на 30 дней.
 *
 * @returns текущий тариф, карточки, состояние и действие смены
 * @example const plans = usePlanSwitch()
 */
export function usePlanSwitch() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)

  const switching = ref<PlanId | null>(null)
  const error = ref<string | null>(null)

  /** Действующий тариф с учётом срока (effective_plan, не сырое поле). */
  const currentPlan = computed<PlanId>(() => {
    const plan = planOf(authUser.value)

    return plan === 'business' ? 'business' : plan === 'pro' ? 'pro' : 'free'
  })

  /**
   * Карточки тарифов: подпись зависит от включённых модулей —
   * без карты (чистый ULove) вместо пинов показываем свайпы.
   *
   * @param showMap включён ли модуль карты UPin
   * @returns мета трёх тарифов для сетки выбора
   */
  function planCards(showMap: boolean): PlanCardMeta[] {
    const summaries: Record<PlanId, string> = showMap
      ? {
          free: '3 пина · 10 км · 4 ч',
          pro: 'Безлимит · 15 км · 12 ч',
          business: 'Безлимит · 50 км · ∞',
        }
      : {
          free: 'Свайпы · 3 сообщения · мэтчи',
          pro: 'Инкогнито · 10 сообщений · хайды',
          business: 'Максимум · 15 сообщений',
        }

    const cards: PlanCardMeta[] = [
      { id: 'free', name: 'Free', price: 'Бесплатно', summary: summaries.free },
      { id: 'pro', name: 'Pro', price: '$4.99 / мес', summary: summaries.pro },
      { id: 'business', name: 'Business', price: '$19.99 / мес', summary: summaries.business },
    ]

    return cards
  }

  /**
   * Подтянуть свежий auth после смены тарифа.
   */
  function refreshAuth(): void {
    try {
      router.reload({ only: ['auth'] })
    } catch {
      return
    }
  }

  /**
   * Переключить тариф: вступает сразу через Subscription API.
   *
   * @param id целевой тариф
   */
  async function switchTo(id: PlanId): Promise<void> {
    if (switching.value || currentPlan.value === id) {
      return
    }

    switching.value = id
    error.value = null

    try {
      if (id === 'free') {
        await subscriptionApi.cancel()
      } else {
        await subscriptionApi.renew(id)
      }

      refreshAuth()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось сменить тариф'
    } finally {
      switching.value = null
    }
  }

  return { currentPlan, switching, error, planCards, switchTo }
}
