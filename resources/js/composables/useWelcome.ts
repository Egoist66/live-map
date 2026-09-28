import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useSeo } from '@/composables/useSeo'

/**
 * Лендинг: ULove — главное, карта с пинами — дополнение.
 * Отдаёт SEO, состояние гостя и готовые CTA-ссылки для шаблона.
 * @returns seo, флаги авторизации и ссылки primary/secondary CTA
 * @example const w = useWelcome()
 */
export function useWelcome() {
  const seo = useSeo({
    title: 'ULove — знакомства рядом | UPin',
    description: 'ULove в UPin — знакомства рядом: свайпы, мэтч открывает чат. Карта с пинами — бонус для общения, встреч и единомышленников: позови на кофе в 2 клика без точного адреса.',
    keywords: ['ULove', 'UPin', 'знакомства рядом', 'свайпы', 'мэтч', 'карта свиданий', 'пины'],
  })

  const page = usePage()
  const isAuthenticated = computed(() => !!((page.props as any).auth as any)?.user)
  const authUser = computed(() => ((page.props as any).auth as any)?.user ?? null)

  const isBusinessAccount = computed(() => authUser.value?.account_type === 'business')

  const homeLanding = computed(() => {
    if (isBusinessAccount.value) {
      return '/cabinet'
    }
    const raw = authUser.value?.default_mode
    if (raw === 'upin' || raw === 'ulove') {
      return raw === 'upin' ? '/map' : '/swipes'
    }
    return authUser.value?.signup_goal === 'neighbors' ? '/map' : '/swipes'
  })

  const isUpinHome = computed(() => homeLanding.value === '/map')

  const primaryCtaHref = computed(() => {
    if (!isAuthenticated.value) {
      return '/login'
    }
    return homeLanding.value
  })
  const primaryCtaLabel = computed(() => {
    if (!isAuthenticated.value) {
      return 'Создать анкету ULove →'
    }
    if (isBusinessAccount.value) {
      return 'Открыть кабинет →'
    }
    return isUpinHome.value ? 'Открыть карту →' : 'Открыть ULove →'
  })
  const profileCtaHref = computed(() => {
    if (!isAuthenticated.value) {
      return '/login'
    }
    return homeLanding.value
  })
  const profileCtaLabel = computed(() => {
    if (!isAuthenticated.value) {
      return 'Войти'
    }
    if (isBusinessAccount.value) {
      return 'Открыть кабинет'
    }
    return isUpinHome.value ? 'Открыть карту' : 'Открыть ULove'
  })

  return { seo, isAuthenticated, isBusinessAccount, primaryCtaHref, primaryCtaLabel, profileCtaHref, profileCtaLabel }
}
