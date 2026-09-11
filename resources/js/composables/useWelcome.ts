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

  const primaryCtaHref = computed(() => (isAuthenticated.value ? '/swipes' : '/register'))
  const primaryCtaLabel = computed(() => (isAuthenticated.value ? 'Открыть ULove →' : 'Создать анкету ULove →'))
  const profileCtaHref = computed(() => (isAuthenticated.value ? '/swipes' : '/login'))
  const profileCtaLabel = computed(() => (isAuthenticated.value ? 'Открыть ULove' : 'Войти'))

  return { seo, isAuthenticated, primaryCtaHref, primaryCtaLabel, profileCtaHref, profileCtaLabel }
}
