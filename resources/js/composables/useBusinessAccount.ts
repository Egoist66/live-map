import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Тип аккаунта текущего пользователя: персона или компания.
 *
 * Единая точка проверки для скрытия персональных разделов
 * (свайпы, ULove, UFlow) у бизнеса и бизнес-разделов у персоны.
 *
 * @returns флаг бизнес-аккаунта
 * @example const { isBusiness } = useBusinessAccount()
 */
export function useBusinessAccount() {
  const page = usePage()

  const isBusiness = computed(() => {
    try {
      return (page.props as unknown as { auth?: { user?: { account_type?: string } | null } }).auth?.user?.account_type === 'business'
    } catch {
      return false
    }
  })

  return { isBusiness }
}
