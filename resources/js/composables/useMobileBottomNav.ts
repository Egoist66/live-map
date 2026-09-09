import { computed } from 'vue'
import { useBadgeStore } from '@/stores/badges'

/** Хук для состояния нижней мобильной навигации. */
export function useMobileBottomNav() {
  const badge = useBadgeStore()

  const dashboardHref = computed(() => route('dashboard'))
  const total = computed(() => badge.unread)

  function isActive(name: string) {
    return route().current(name)
  }

  return { dashboardHref, isActive, total }
}
