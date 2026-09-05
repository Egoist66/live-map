import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useBadgeStore } from '@/stores/badges'

export function useMobileBottomNav() {
  const badge = useBadgeStore()
  const page = usePage()
  const user = computed(() => (page.props.auth as any)?.user)
  const isAdmin = computed(() => user.value?.is_admin || user.value?.role === 'admin')
  const dashboardHref = computed(() => {
    if (!user.value) return route('dashboard')
    const id = isAdmin.value ? 'admin' : String(user.value.id)
    return route('dashboard', { identifier: id })
  })
  const total = computed(() => badge.total)
  function isActive(name: string) {
    return route().current(name)
  }
  return { dashboardHref, isActive, total }
}
