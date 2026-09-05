import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'

export const SUPPORT_EMAIL = 'razormad666@gmail.com'
const NEW_USER_DAYS = 90

const visible = ref(false)
let scheduled = false

export function useBetaNotice() {
  const page = usePage()
  const user = computed(() => (page.props.auth as any)?.user ?? null)

  const storageKey = computed(() => (user.value?.id ? `upin_beta_notice_seen_${user.value.id}` : null))

  const isNewUser = computed(() => {
    if (!user.value) return false
    if (!user.value.created_at) return true
    const created = new Date(user.value.created_at).getTime()
    if (Number.isNaN(created)) return true
    return (Date.now() - created) / 86400000 < NEW_USER_DAYS
  })

  function alreadySeen(): boolean {
    if (typeof window === 'undefined' || !storageKey.value) return true
    try {
      return !!window.localStorage.getItem(storageKey.value)
    } catch {
      return false
    }
  }

  function shouldShow(): boolean {
    return !!user.value && isNewUser.value && !alreadySeen()
  }

  function open() {
    visible.value = true
  }

  function dismiss() {
    visible.value = false
    try {
      if (typeof window !== 'undefined' && storageKey.value) window.localStorage.setItem(storageKey.value, '1')
    } catch {
    }
  }

  function maybeShow(delay = 900) {
    if (typeof window === 'undefined' || scheduled || visible.value || !shouldShow()) return
    scheduled = true
    window.setTimeout(() => {
      if (shouldShow()) visible.value = true
    }, delay)
  }

  function contact() {
    if (typeof window === 'undefined') return
    const subj = encodeURIComponent('UPin — баг / вопрос (закрытый тест)')
    const who = user.value ? encodeURIComponent(`\n\n---\nПользователь: ${user.value.name} <${user.value.email}>`) : ''
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subj}&body=${who}`
  }

  return { visible, isNewUser, open, dismiss, maybeShow, contact }
}
