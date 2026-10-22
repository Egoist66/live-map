import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'

type SeoInput = {
  title: string
  description: string
  keywords?: string[]
  canonical?: string
  image?: string
  type?: string
  noindex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

type SharedSeoPage = {
  title?: string | null
  description?: string | null
  keywords?: string | null
  og_title?: string | null
  og_description?: string | null
  og_image?: string | null
  canonical?: string | null
  robots?: string | null
  enabled?: boolean
}

type SharedSeoGlobal = {
  site_name?: string | null
  title?: string | null
  description?: string | null
  keywords?: string[] | null
  robots?: string | null
  og_image?: string | null
}

/**
 * Хук SEO-мета для страницы (Inertia Head).
 *
 * Приоритет значений:
 * 1. Переопределение из панели SEO (админка → SEO → Страницы) — сервер
 *    кладёт его в shared-проп `seo.page` для текущего пути;
 * 2. Глобальные настройки из панели SEO (админка → SEO → Общее) —
 *    сервер кладёт их в shared-проп `seo.global`;
 * 3. Значения, захардкоженные в странице (input) — последний фолбэк,
 *    если админ ничего не задал;
 * 4. Приватные страницы (`noindex: true`) всегда отдают `noindex, nofollow`.
 *
 * @param input захардкоженные мета страницы (фолбэк, если админка пуста)
 * @returns title/description/canonical/robots/head для `<Head>`.
 * @example
 * const seo = useSeo({ title: 'FAQ — ULove', description: '…' })
 */
export function useSeo(input: SeoInput) {
  const sharedPage = computed<SharedSeoPage | null>(() => {
    try {
      const raw = (usePage().props as unknown as { seo?: { page?: SharedSeoPage } }).seo
      const row = raw?.page
      if (row && row.enabled !== false && (row.title || row.description)) return row
      return null
    } catch {
      return null
    }
  })

  const sharedGlobal = computed<SharedSeoGlobal | null>(() => {
    try {
      const raw = (usePage().props as unknown as { seo?: { global?: SharedSeoGlobal } }).seo
      return raw?.global ?? null
    } catch {
      return null
    }
  })

  const overrideKeywords = computed<string[] | null>(() => {
    const raw = sharedPage.value?.keywords
    if (!raw) return null
    const parts = raw
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '')
    return parts.length ? parts : null
  })

  const globalKeywords = computed<string[] | null>(() => {
    const list = sharedGlobal.value?.keywords
    if (!Array.isArray(list) || !list.length) return null
    return list
  })

  const title = computed(() => sharedPage.value?.title || sharedGlobal.value?.title || input.title)
  const description = computed(() => sharedPage.value?.description || sharedGlobal.value?.description || input.description)
  const keywords = computed(() => overrideKeywords.value ?? globalKeywords.value ?? input.keywords)
  const canonical = computed(
    () => sharedPage.value?.canonical || input.canonical || (typeof window !== 'undefined' ? window.location.href : undefined),
  )
  const robots = computed(() => {
    if (input.noindex) return 'noindex, nofollow'
    return sharedPage.value?.robots || sharedGlobal.value?.robots || undefined
  })
  const image = computed(() => sharedPage.value?.og_image || sharedGlobal.value?.og_image || input.image)
  const ogTitle = computed(() => sharedPage.value?.og_title || title.value)
  const ogDescription = computed(() => sharedPage.value?.og_description || description.value)

  const head = computed(() => ({
    title: title.value,
    meta: [
      { name: 'description', content: description.value },
      ...(keywords.value?.length ? [{ name: 'keywords', content: keywords.value.join(', ') }] : []),
      ...(robots.value ? [{ name: 'robots', content: robots.value }] : []),
      { property: 'og:title', content: ogTitle.value },
      { property: 'og:description', content: ogDescription.value },
      { property: 'og:type', content: input.type ?? 'website' },
      ...(canonical.value ? [{ property: 'og:url', content: canonical.value }] : []),
      ...(image.value ? [{ property: 'og:image', content: image.value }] : []),
      { name: 'twitter:title', content: ogTitle.value },
      { name: 'twitter:description', content: ogDescription.value },
      ...(image.value ? [{ name: 'twitter:image', content: image.value }] : []),
      ...(canonical.value ? [{ name: 'canonical', content: canonical.value }] : []),
    ].filter(Boolean),
  }))

  return { title, description, canonical, robots, head, jsonLd: input.jsonLd }
}
