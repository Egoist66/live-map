import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { chatApi } from '@/services/chat.api'
import { planOf } from './usePlanLimits'

export function hiddenLimitFor(plan?: string, isAdmin?: boolean): number | null {
  if (isAdmin) return null
  if (plan === 'business') return null
  if (plan === 'pro') return 3
  return 1
}

export function hiddenLimitLabel(limit: number | null | undefined): string {
  if (limit === null || limit === undefined) return '∞'
  return String(limit)
}

export function useHiddenFriends() {
  const page = usePage()
  const authUser = computed(() => (page.props.auth as any)?.user)
  const friends = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const hiddenCount = ref(0)
  const hiddenLimit = ref<number | null>(1)
  const hiddenUnlimited = ref(false)
  const showHidden = ref(true)
  const query = ref('')

  const plan = computed(() => planOf(authUser.value))
  const isAdmin = computed(() => !!authUser.value?.is_admin || authUser.value?.role === 'admin')
  const effectiveLimit = computed(() => {
    if (hiddenUnlimited.value || isAdmin.value) return null
    return hiddenLimit.value ?? hiddenLimitFor(plan.value, false)
  })
  const canHideMore = computed(() => {
    if (effectiveLimit.value === null) return true
    return hiddenCount.value < (effectiveLimit.value ?? 0)
  })
  const limitText = computed(() => {
    if (effectiveLimit.value === null) return isAdmin.value ? 'режим бога: без лимитов' : 'безлимит (Business)'
    return `${hiddenCount.value} / ${effectiveLimit.value}`
  })
  const visibleFriends = computed(() => {
    const q = query.value.trim().toLowerCase()
    return friends.value.filter((f) => {
      if (!showHidden.value && f.is_hidden) return false
      if (!q) return true
      return (f.other?.name || '').toLowerCase().includes(q)
    })
  })

  async function load() {
    loading.value = true
    error.value = null
    try {
      const d: any = await chatApi.friendships()
      friends.value = d.friends || []
      hiddenCount.value = d.hidden_count ?? friends.value.filter((f: any) => f.is_hidden).length
      hiddenLimit.value = d.hidden_limit ?? hiddenLimitFor(plan.value, isAdmin.value)
      hiddenUnlimited.value = !!d.hidden_unlimited || isAdmin.value
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Не удалось загрузить друзей'
    } finally {
      loading.value = false
    }
  }

  async function toggle(friendshipId: number, value?: boolean) {
    const target = friends.value.find((f) => f.id === friendshipId)
    const next = value ?? !target?.is_hidden
    if (next && !canHideMore.value && !target?.is_hidden) {
      error.value = `Лимит исчерпан (${hiddenLimitLabel(effectiveLimit.value)}). Обновите тариф.`
      throw new Error(error.value)
    }
    const prev = target ? [...friends.value] : null
    if (target) target.is_hidden = next
    hiddenCount.value += next ? 1 : -1
    if (hiddenCount.value < 0) hiddenCount.value = 0
    try {
      const d: any = await chatApi.toggleHidden(friendshipId, next)
      if (target) target.is_hidden = !!d.is_hidden
      hiddenCount.value = d.hidden_count ?? hiddenCount.value
      hiddenLimit.value = d.hidden_limit ?? hiddenLimit.value
      hiddenUnlimited.value = !!d.hidden_unlimited
      error.value = null
      return d
    } catch (e: any) {
      if (prev) friends.value = prev
      await load()
      error.value = e?.response?.data?.message || 'Не удалось обновить'
      throw e
    }
  }

  return { friends, visibleFriends, loading, error, hiddenCount, hiddenLimit: effectiveLimit, hiddenUnlimited, canHideMore, limitText, showHidden, query, plan, isAdmin, load, toggle }
}
