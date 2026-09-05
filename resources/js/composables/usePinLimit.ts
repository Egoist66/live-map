import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { usePinsStore } from '@/stores/pins'
import { isPinAlive } from '@/composables/usePinExpiry'

export const FREE_PINS_LIMIT = 3

export function usePinLimit() {
  const page = usePage() as any
  const store = usePinsStore()
  const user = computed(() => page.props.auth?.user)
  const plan = computed(() => user.value?.plan || 'free')
  const isUnlimited = computed(() => {
    const u = user.value
    return !!u?.is_admin || u?.role === 'admin' || plan.value === 'pro' || plan.value === 'business'
  })

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
      ? `Лимит free тарифа: у тебя уже ${used.value} живых пина из ${FREE_PINS_LIMIT}. Истёкшие (живут 4 часа) и удалённые освобождают место — дождись или удали лишний.`
      : '',
  )

  async function refresh(): Promise<number> {
    if (isUnlimited.value) return 0
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

  return { limit, used, remaining, isExceeded, warning, checking, refresh, isUnlimited }
}
