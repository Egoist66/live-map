import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Состояние гостевого лейаута (вход, регистрация, FAQ).
 *
 * Определяет, нужно ли показывать подвал и сайдбар. На страницах
 * auth-флоу (`Auth/*`: вход, регистрация, восстановление пароля)
 * футер и левый сайдбар скрыты на всех устройствах — только
 * центрированная карточка на тематическом фоне `AuthBackdrop`.
 *
 * @returns флаги гостевого лейаута
 * @example
 * const { isFaq, isAuthPage, shouldShowFooter } = useGuestLayout()
 */
export function useGuestLayout() {
  const page = usePage()

  const isFaq = computed(() => page.component === 'Faq')

  const isAuthPage = computed(() => {
    const componentName = String(page.component ?? '')

    return componentName.startsWith('Auth/')
  })

  const shouldShowFooter = computed(() => !isAuthPage.value)

  return { isFaq, isAuthPage, shouldShowFooter }
}
