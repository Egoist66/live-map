import { ref, computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import axios from 'axios'
import { setPresenceInvisible } from '@/composables/usePresence'
import { planOf } from '@/composables/usePlanLimits'

export function useInvisible() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any)?.user)
  const isInvisible = ref<boolean>(!!user.value?.is_invisible)
  const canUse = computed(() => {
    const u = user.value
    if (!u) return false
    return u.is_admin || u.role === 'admin' || ['pro', 'business'].includes(planOf(u))
  })
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function toggle(value: boolean) {
    if (!canUse.value) {
      error.value = 'Недоступно для вашего тарифа — нужен Pro и выше'
      return
    }
    loading.value = true
    error.value = null
    try {
      const { data } = await axios.patch('/api/user/invisible', { is_invisible: value })
      isInvisible.value = !!data.is_invisible
      if (user.value) user.value.is_invisible = isInvisible.value
      try {
        const w = window as any
        if (w.__inertia_page?.props?.auth?.user) w.__inertia_page.props.auth.user.is_invisible = isInvisible.value
        if ((document as any).__page_auth_user) (document as any).__page_auth_user.is_invisible = isInvisible.value
      } catch {}
      setPresenceInvisible(isInvisible.value)
    } catch (e: any) {
      error.value = e?.response?.data?.message || 'Ошибка переключения невидимки'
      throw e
    } finally {
      loading.value = false
    }
  }

  return { isInvisible, canUse, loading, error, toggle }
}
