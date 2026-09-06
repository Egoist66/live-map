import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { usePinsStore } from '@/stores/pins'
import { isPinAlive } from '@/composables/usePinExpiry'
import { planOf } from '@/composables/usePlanLimits'

export const FREE_PINS_LIMIT = 3
const TTL_BY_PLAN: Record<string, number | null> = { pro: 12, business: null }

export function usePinLimit() {
  const page = usePage() as any
  const store = usePinsStore()
  const user = computed(() => page.props.auth?.user)
  const plan = computed(() => planOf(user.value))
  const isAdmin = computed(() => !!user.value?.is_admin || user.value?.role === 'admin')
  const isUnlimited = computed(() => isAdmin.value || plan.value === 'pro' || plan.value === 'business')
  const isFree = computed(() => !isUnlimited.value)

  const ttlHours = computed(() => (isAdmin.value || plan.value === 'business' ? null : (TTL_BY_PLAN[plan.value] ?? 4)))
  const ttlLabel = computed(() => (ttlHours.value === null ? '∞' : `${ttlHours.value} ч`))

  const myLiveCount = ref<number | null>(null)
  const checking = ref(false)

  const limit = computed(() => (isUnlimited.value ? Infinity : FREE_PINS_LIMIT))
  const used = computed(() => {
    if (myLiveCount.value !== null) return myLiveCount.value
    const uid = user.value?.id
    if (!uid) return 0
    return (store.pins as any[]).filter(
      (p) => p.user_id === uid && (isPinAlive(p) || p.status === 'scheduled'),
    ).length
  })
  const remaining = computed(() => (isUnlimited.value ? Infinity : Math.max(0, FREE_PINS_LIMIT - used.value)))
  const isExceeded = computed(() => !isUnlimited.value && used.value >= FREE_PINS_LIMIT)
  const warning = computed(() =>
    isExceeded.value
      ? `Лимит free тарифа: у тебя уже ${used.value} живых пина из ${FREE_PINS_LIMIT}. Истёкшие (живут 4 часа) и удалённые освобождают место — удали лишний и создавай заново.`
      : '',
  )
  const statusText = computed(() =>
    isUnlimited.value
      ? `Безлимит · пины живут ${ttlLabel.value}`
      : `${used.value} из ${FREE_PINS_LIMIT} живых · свободно ${remaining.value} · живут ${ttlLabel.value} · удаление или истечение освобождает место`,
  )

  async function refresh(): Promise<number> {
    if (isUnlimited.value) {
      myLiveCount.value = 0
      return 0
    }
    checking.value = true
    try {
      const mine = await store.fetchMine()
      const n = (mine as any[]).filter((p) => isPinAlive(p) || (p as any).status === 'scheduled').length
      myLiveCount.value = n
      return n
    } catch {
      return used.value
    } finally {
      checking.value = false
    }
  }

  return { limit, used, remaining, isExceeded, warning, statusText, checking, refresh, isUnlimited, isFree, ttlHours, ttlLabel }
}
