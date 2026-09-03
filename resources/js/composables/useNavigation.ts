import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { avatarSrcFor } from '@/composables/useAvatar'

export function useNavigation() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any).user)
  const avatarSrc = computed(() => avatarSrcFor(user.value))
  const dashboardHref = computed(() => {
    const u = user.value
    if (!u) return route('dashboard')
    const id = u.is_admin || u.role === 'admin' ? 'admin' : String(u.id)
    return route('dashboard', { identifier: id })
  })
  const settingsHref = computed(() => {
    const u = user.value
    if (!u) return route('profile.edit')
    const id = u.is_admin || u.role === 'admin' ? 'admin' : String(u.id)
    return route('profile.edit', { identifier: id })
  })
  return { user, avatarSrc, dashboardHref, settingsHref }
}
