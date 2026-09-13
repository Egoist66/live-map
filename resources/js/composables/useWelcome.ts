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
    description: 'ULove — знакомства рядом: свайпы, мэтч открывает чат. Карта и пины в помощь: вопросы, события и встречи рядом без точного адреса.',
    keywords: ['ULove', 'UPin', 'знакомства рядом', 'свайпы', 'мэтч', 'карта свиданий', 'пины'],
  })

  const page = usePage()
  const isAuthenticated = computed(() => !!((page.props as any).auth as any)?.user)
  const authUser = computed(() => ((page.props as any).auth as any)?.user ?? null)

  const homeLanding = computed(() => {
    const raw = authUser.value?.default_mode
    if (raw === 'upin' || raw === 'ulove') {
      return raw === 'upin' ? '/map' : '/swipes'
    }
    return authUser.value?.signup_goal === 'neighbors' ? '/map' : '/swipes'
  })

  const isUpinHome = computed(() => homeLanding.value === '/map')

  const primaryCtaHref = computed(() => {
    if (!isAuthenticated.value) {
      return '/register'
    }
    return homeLanding.value
  })
  const primaryCtaLabel = computed(() => {
    if (!isAuthenticated.value) {
      return 'Создать анкету ULove →'
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
    return isUpinHome.value ? 'Открыть карту' : 'Открыть ULove'
  })

  return { seo, isAuthenticated, primaryCtaHref, primaryCtaLabel, profileCtaHref, profileCtaLabel }
}
