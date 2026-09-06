import { computed } from 'vue'
import { useBadgeStore } from '@/stores/badges'

export function useMobileBottomNav() {
  const badge = useBadgeStore()
  const dashboardHref = computed(() => {
    return route('dashboard')
  })
  const total = computed(() => badge.total)
  function isActive(name: string) {
    return route().current(name)
  }
  return { dashboardHref, isActive, total }
}
