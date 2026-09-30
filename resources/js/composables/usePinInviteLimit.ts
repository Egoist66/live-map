import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { pinInvitesApi } from '@/services/pinInvites.api'
import { planOf } from '@/composables/usePlanLimits'

export const FREE_PIN_INVITES_MONTH_LIMIT = 3

/**
 * Месячный лимит приглашений в пин.
 *
 * Free — 3 в месяц, pro/premium/business/стафф — безлимит.
 *
 * @example
 * const { remainingText, refresh } = usePinInviteLimit()
 * await refresh()
 */
export function usePinInviteLimit() {
  const page = usePage() as any
  const user = computed(() => page.props.auth?.user)
  const plan = computed(() => planOf(user.value))
  const isAdmin = computed(() => !!user.value?.is_admin || user.value?.role === 'admin')
  const isStaff = computed(() => isAdmin.value || user.value?.role === 'moderator')
  const isUnlimited = computed(() => isStaff.value || plan.value === 'pro' || plan.value === 'premium' || plan.value === 'business')

  const used = ref(0)
  const checking = ref(false)

  const remaining = computed(() => (isUnlimited.value ? null : Math.max(0, FREE_PIN_INVITES_MONTH_LIMIT - used.value)))
  const isExceeded = computed(() => !isUnlimited.value && used.value >= FREE_PIN_INVITES_MONTH_LIMIT)
  const remainingText = computed(() => {
    if (isUnlimited.value) {
      return 'Безлимит приглашений · Pro'
    }
    return `Осталось ${remaining.value} из ${FREE_PIN_INVITES_MONTH_LIMIT} приглашений в этом месяце`
  })

  /**
   * Обновить счётчик с сервера.
   * @returns использовано за месяц
   */
  async function refresh(): Promise<number> {
    if (isUnlimited.value) {
      used.value = 0
      return 0
    }
    checking.value = true
    try {
      const info = await pinInvitesApi.usage()
      used.value = Number(info.used ?? 0)
      return used.value
    } catch {
      return used.value
    } finally {
      checking.value = false
    }
  }

  return { used, remaining, isExceeded, isUnlimited, checking, remainingText, refresh }
}
