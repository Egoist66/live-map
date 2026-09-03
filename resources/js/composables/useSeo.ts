import { computed } from 'vue'

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

export function useSeo(input: SeoInput) {
  const title = computed(() => input.title)
  const description = computed(() => input.description)
  const canonical = computed(() => input.canonical ?? (typeof window !== 'undefined' ? window.location.href : undefined))
  const robots = computed(() => (input.noindex ? 'noindex, nofollow' : undefined))

  const head = computed(() => ({
    title: input.title,
    meta: [
      { name: 'description', content: input.description },
      ...(input.keywords?.length ? [{ name: 'keywords', content: input.keywords.join(', ') }] : []),
      ...(robots.value ? [{ name: 'robots', content: robots.value }] : []),
      { property: 'og:title', content: input.title },
      { property: 'og:description', content: input.description },
      { property: 'og:type', content: input.type ?? 'website' },
      ...(canonical.value ? [{ property: 'og:url', content: canonical.value }] : []),
      ...(input.image ? [{ property: 'og:image', content: input.image }] : []),
      { name: 'twitter:title', content: input.title },
      { name: 'twitter:description', content: input.description },
      ...(input.image ? [{ name: 'twitter:image', content: input.image }] : []),
      ...(canonical.value ? [{ name: 'canonical', content: canonical.value }] : []),
    ].filter(Boolean),
  }))

  return { title, description, canonical, robots, head, jsonLd: input.jsonLd }
}
