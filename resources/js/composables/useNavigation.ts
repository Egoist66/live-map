import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { route } from '@/route'
import { avatarSrcFor } from '@/composables/useAvatar'

export function useNavigation() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const avatarSrc = computed(() => avatarSrcFor(user.value))
  const dashboardHref = computed(() => {
    return route('dashboard')
  })
  const settingsHref = computed(() => {
    return route('profile.edit')
  })
  return { user, avatarSrc, dashboardHref, settingsHref }
}
