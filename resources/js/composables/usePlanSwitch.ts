import { computed, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { subscriptionApi } from '@/services/subscription.api'
import { planOf } from '@/composables/usePlanLimits'
import { usePlansCatalog } from '@/composables/usePlansCatalog'
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
 * Free — откат подписки, Pro/Premium — продление на 30 дней.
 * Business — только для организаторов (кабинет компании).
 * Стафф (админ/модератор) всегда на Premium по умолчанию.
 *
 * @returns текущий тариф, карточки, состояние и действие смены
 * @example const plans = usePlanSwitch()
 */
export function usePlanSwitch() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)
  const { priceFor, catalog } = usePlansCatalog()

  const switching = ref<PlanId | null>(null)
  const error = ref<string | null>(null)

  /** Действующий тариф с учётом срока (effective_plan, не сырое поле). */
  const currentPlan = computed<PlanId>(() => {
    const plan = planOf(authUser.value)

    if (plan === 'business') return 'business'
    if (plan === 'premium') return 'premium'
    return plan === 'pro' ? 'pro' : 'free'
  })

  /** Организатор ли это (кабинет компании): только им доступен Business. */
  const isOrganization = computed(() => {
    const u = authUser.value
    return u?.role === 'organization' || (u?.account_type ?? 'person') === 'business'
  })

  /** Стафф ли это: им Premium доступен по умолчанию. */
  const isStaff = computed(() => {
    const u = authUser.value
    return !!u?.is_admin || u?.role === 'admin' || u?.role === 'moderator'
  })

  /**
   * Живое название тарифа из каталога (админка поверх конфига).
   *
   * @param id идентификатор тарифа
   * @param fallback запасное название
   * @returns название тарифа
   */
  function planName(id: PlanId, fallback: string): string {
    return catalog.value?.plans.find((plan) => plan.id === id)?.name || fallback
  }

  /**
   * Карточки тарифов: подпись зависит от включённых модулей —
   * без карты (чистый ULove) вместо пинов показываем свайпы.
   * Premium — топ для персон, Business — только организациям
   * (карточка добавляется лишь при role=organization / business-аккаунте).
   * Названия и цены — из каталога бэка (config/plans.php), не хардкод.
   *
   * @param showMap включён ли модуль карты UPin
   * @returns мета тарифов для сетки выбора
   */
  function planCards(showMap: boolean): PlanCardMeta[] {
    const summaries: Record<PlanId, string> = showMap
      ? {
          free: '3 пина · 10 км · 4 ч',
          pro: 'Безлимит · 15 км · 12 ч',
          premium: 'Безлимит · 50 км · ∞',
          business: 'Кабинет · 50 км · ∞',
        }
      : {
          free: 'Свайпы · 3 сообщения · мэтчи',
          pro: 'Инкогнито · 20 сообщений · хайды · репутация 10',
          premium: 'Максимум · сброс безлимит · репутация 10',
          business: 'Кабинет · максимум',
        }

    const cards: PlanCardMeta[] = [
      { id: 'free', name: planName('free', 'Free'), price: priceFor('free'), summary: summaries.free },
      { id: 'pro', name: planName('pro', 'Pro'), price: priceFor('pro'), summary: summaries.pro },
      { id: 'premium', name: planName('premium', 'Premium'), price: priceFor('premium'), summary: summaries.premium },
    ]

    if (isOrganization.value) {
      cards.push({ id: 'business', name: planName('business', 'Business'), price: priceFor('business'), summary: summaries.business })
    }

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
   * Пользователям доступны только Free / Pro / Premium:
   * Business им не выдаём даже при прямом вызове — он только
   * для организаторов (бэкенд тоже отклоняет 422).
   *
   * @param id целевой тариф
   */
  async function switchTo(id: PlanId): Promise<void> {
    if (switching.value || currentPlan.value === id) {
      return
    }

    if (id === 'business' && !isOrganization.value) {
      error.value = 'Тариф Business — только для организаторов (кабинет компании). Выбери Premium — это тот же максимум.'
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

  return { currentPlan, switching, error, planCards, switchTo, isOrganization, isStaff }
}
