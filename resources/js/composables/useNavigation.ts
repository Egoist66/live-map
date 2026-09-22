import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import { avatarSrcFor } from '@/composables/useAvatar'

export function useNavigation() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const avatarSrc = computed(() => avatarSrcFor(user.value))
  /**
   * Бизнес ведём в кабинет, персону — в профиль.
   */
  const isBusiness = computed(() => {
    try {
      return (user.value as { account_type?: string } | null)?.account_type === 'business'
    } catch {
      return false
    }
  })
  const dashboardHref = computed(() => {
    if (isBusiness.value) {
      return '/cabinet'
    }
    return route('dashboard')
  })
  const settingsHref = computed(() => {
    if (isBusiness.value) {
      return '/cabinet/settings'
    }
    return route('profile.edit')
  })
  return { user, avatarSrc, dashboardHref, settingsHref, isBusiness }
}
