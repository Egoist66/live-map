import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Состояние гостевого лейаута (вход, регистрация, FAQ).
 *
 * Определяет, нужно ли показывать подвал и сайдбар. На страницах
 * auth-флоу (`Auth/*`: вход, регистрация, восстановление пароля)
 * футер и левый сайдбар скрыты на всех устройствах — только
 * центрированная карточка на тематическом фоне `AuthBackdrop`.
 * На FAQ левый промо-сайдбар тоже не нужен: страница читается
 * на всю ширину, без отвлекающей колонки.
 *
 * @returns флаги гостевого лейаута
 * @example
 * const { isFaq, isAuthPage, shouldShowFooter, showSidebar } = useGuestLayout()
 */
export function useGuestLayout() {
  const page = usePage()

  const isFaq = computed(() => page.component === 'Faq')

  const isAuthPage = computed(() => {
    const componentName = String(page.component ?? '')

    return componentName.startsWith('Auth/')
  })

  const shouldShowFooter = computed(() => !isAuthPage.value)

  /** Левый промо-сайдбар: только не на auth-страницах и не в FAQ. */
  const showSidebar = computed(() => !isAuthPage.value && !isFaq.value)

  return { isFaq, isAuthPage, shouldShowFooter, showSidebar }
}
