import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useSeo } from '@/composables/useSeo'

/**
 * Лендинг ULove: статичное SEO про знакомства и CTA-ссылки для шаблона.
 * @returns seo, флаги авторизации и ссылки primary/secondary CTA
 * @example const w = useWelcome()
 */
export function useWelcome() {
  const seo = useSeo({
    title: 'ULove — знакомства рядом',
    description: 'ULove — знакомства рядом: свайпы, мэтч открывает чат. Листай людей рядом, лайкай в один тап, переписывайся только по взаимности. Строго 18+.',
    keywords: ['ULove', 'знакомства рядом', 'свайпы', 'мэтч', 'дейтинг'],
  })

  const page = usePage()
  const isAuthenticated = computed(() => !!((page.props as any).auth as any)?.user)
  const authUser = computed(() => ((page.props as any).auth as any)?.user ?? null)

  const isBusinessAccount = computed(() => authUser.value?.account_type === 'business')

  const homeLanding = computed(() => {
    if (isBusinessAccount.value) {
      return '/cabinet'
    }
    return '/swipes'
  })

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
    return 'Открыть ULove →'
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
    return 'Открыть ULove'
  })

  return { seo, isAuthenticated, isBusinessAccount, primaryCtaHref, primaryCtaLabel, profileCtaHref, profileCtaLabel }
}
