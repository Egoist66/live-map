import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Состояние гостевого лейаута (вход, регистрация, FAQ).
 *
 * Определяет, нужно ли показывать подвал. На страницах
 * входа и регистрации футер скрыт на всех устройствах,
 * чтобы форма занимала весь экран без лишнего скролла.
 *
 * @returns флаги гостевого лейаута
 * @example
 * const { isFaq, isAuthPage, shouldShowFooter } = useGuestLayout()
 */
export function useGuestLayout() {
  const page = usePage()

  const isFaq = computed(() => page.component === 'Faq')

  const isAuthPage = computed(() => {
    const componentName = page.component

    return componentName === 'Auth/Login' || componentName === 'Auth/Register'
  })

  const shouldShowFooter = computed(() => !isAuthPage.value)

  return { isFaq, isAuthPage, shouldShowFooter }
}
