import { computed, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { subscriptionApi, type SubscriptionStatus } from '@/services/subscription.api'
import { usePlansCatalog } from '@/composables/usePlansCatalog'

const SNOOZE_KEY = 'subscription_renew_snooze'

/**
 * Окно продления подписки PRO/Premium/Business.
 *
 * Показываем за 3 дня до конца срока и в грейс-период после:
 * «Продлить» сдвигает срок на месяц, «Отказаться» откатывает на free.
 * «Напомнить позже» доступно только пока срок не истёк.
 * Business — только для организаторов, Premium — топ для остальных.
 *
 * @returns состояние подписки и действия окна
 *
 * @example
 * const renewal = useSubscriptionRenewal()
 * onMounted(() => renewal.check())
 */
export function useSubscriptionRenewal() {
  const status = ref<SubscriptionStatus | null>(null)
  const loading = ref(false)
  const acting = ref(false)
  const error = ref<string | null>(null)
  const { priceFor } = usePlansCatalog()

  /**
   * Отложено ли окно на сегодня (только для неистёкших).
   */
  function isSnoozed(): boolean {
    try {
      return localStorage.getItem(SNOOZE_KEY) === new Date().toDateString()
    } catch {
      return false
    }
  }

  const visible = computed(() => {
    if (!status.value?.needs_renewal) return false
    if (status.value.expired) return true
    return !isSnoozed()
  })

  const planName = computed(() => {
    const plan = status.value?.plan
    if (plan === 'business') return 'Business'
    if (plan === 'premium') return 'Premium'
    return 'PRO'
  })

  const priceLabel = computed(() => {
    const plan = status.value?.plan ?? 'pro'
    return priceFor(plan === 'business' || plan === 'premium' ? plan : 'pro')
  })

  const expiryLabel = computed(() => {
    if (!status.value?.expires_at) return ''
    try {
      return new Date(status.value.expires_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
    } catch {
      return ''
    }
  })

  /**
   * Подтянуть статус подписки с бэка.
   */
  async function check(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      status.value = await subscriptionApi.status()
    } catch {
      status.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * Обновить данные страницы после смены тарифа.
   */
  function refreshPage(): void {
    try {
      router.reload({ only: ['auth'] })
    } catch {
      return
    }
  }

  /**
   * Продлить текущий тариф на месяц вперёд.
   */
  async function renew(): Promise<void> {
    if (!status.value || acting.value) return
    const raw = status.value.plan
    const plan = raw === 'business' || raw === 'premium' ? raw : 'pro'
    acting.value = true
    error.value = null
    try {
      status.value = await subscriptionApi.renew(plan)
      refreshPage()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось продлить подписку'
    } finally {
      acting.value = false
    }
  }

  /**
   * Отказаться от подписки: немедленный откат на free.
   */
  async function decline(): Promise<void> {
    if (acting.value) return
    acting.value = true
    error.value = null
    try {
      status.value = await subscriptionApi.cancel()
      refreshPage()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Не удалось отменить подписку'
    } finally {
      acting.value = false
    }
  }

  /**
   * Напомнить завтра: прячем окно до следующего дня.
   */
  function snooze(): void {
    try {
      localStorage.setItem(SNOOZE_KEY, new Date().toDateString())
    } catch {
      return
    }
    status.value = status.value ? { ...status.value, needs_renewal: false } : status.value
  }

  return { status, loading, acting, error, visible, planName, priceLabel, expiryLabel, check, renew, decline, snooze }
}
