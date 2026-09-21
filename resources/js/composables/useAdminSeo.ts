import { computed, ref } from 'vue'
import {
  adminSeoApi,
  type SeoGlobal,
  type SeoIntegrations,
  type SeoPageEntry,
  type SeoRobots,
  type SeoSitemap,
} from '@/services/admin-seo.api'

const ROBOTS_PRESETS = [
  'index, follow',
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  'noindex, nofollow',
  'noindex, follow',
  'index, nofollow',
]

/**
 * Хук управления разделом SEO в админ-панели (стиль WordPress / RankMath).
 *
 * Держит 5 секций (глобальное, страницы, интеграции, robots, sitemap),
 * грузит всё одним запросом и сохраняет посекционно. Компонент только
 * отображает состояние и вызывает методы — вся логика здесь.
 *
 * @returns Состояние секций, сниппет-превью и методы load/save.
 * @example
 * const seo = useAdminSeo()
 * await seo.load()
 * await seo.saveGlobal()
 */
export function useAdminSeo() {
  const loading = ref(false)
  const saving = ref<string | null>(null)
  const error = ref<string | null>(null)
  const savedAt = ref<string | null>(null)
  const knownPaths = ref<string[]>([])

  const global = ref<SeoGlobal>({
    site_name: '',
    title_suffix: '',
    default_title: '',
    default_description: '',
    keywords: '',
    author: '',
    locale: 'ru_RU',
    og_type: 'website',
    twitter_card: 'summary_large_image',
    twitter_site: '',
    theme_color: '#0F172A',
    og_image: '/og-cover.jpg',
    robots_default: '',
  })

  const integrations = ref<SeoIntegrations>({
    google_site_verification: '',
    yandex_verification: '',
    bing_verification: '',
    google_analytics_id: '',
    google_tag_manager_id: '',
    yandex_metrica_id: '',
    facebook_pixel_id: '',
    vk_pixel_id: '',
    scripts_enabled: true,
    head_scripts: '',
    body_start_scripts: '',
    body_end_scripts: '',
  })

  const pages = ref<SeoPageEntry[]>([])

  const robots = ref<SeoRobots>({
    mode: 'auto',
    custom_text: '',
    extra_disallow: [],
    extra_allow: [],
    crawl_delay: 1,
    sitemap_enabled: true,
  })

  const sitemap = ref<SeoSitemap>({
    enabled: true,
    extra_urls: [],
    excluded_paths: [],
  })

  const editingPage = ref<SeoPageEntry | null>(null)
  const editingOriginalPath = ref<string | null>(null)
  const showPageDialog = ref(false)
  const isNewPage = ref(false)

  const extraDisallowText = ref('')
  const extraAllowText = ref('')
  const extraUrlsText = ref('')
  const excludedPathsText = ref('')

  const keywordsText = computed({
    get: () => {
      const raw = global.value.keywords
      if (Array.isArray(raw)) return raw.join(', ')
      return String(raw ?? '')
    },
    set: (value: string) => {
      global.value.keywords = value
    },
  })

  const titleLength = computed(() => String(global.value.default_title ?? '').length)
  const descriptionLength = computed(() => String(global.value.default_description ?? '').length)

  const titleOk = computed(() => titleLength.value >= 10 && titleLength.value <= 70)
  const descriptionOk = computed(() => descriptionLength.value >= 50 && descriptionLength.value <= 160)

  function markSaved(): void {
    const now = new Date()
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    savedAt.value = `${hours}:${minutes}`
  }

  function describeError(e: unknown, fallback: string): string {
    const err = e as { response?: { data?: { message?: string } } }
    return err?.response?.data?.message || fallback
  }

  function syncTextAreas(): void {
    extraDisallowText.value = robots.value.extra_disallow.join('\n')
    extraAllowText.value = robots.value.extra_allow.join('\n')
    extraUrlsText.value = sitemap.value.extra_urls.join('\n')
    excludedPathsText.value = sitemap.value.excluded_paths.join('\n')
  }

  function splitLines(text: string): string[] {
    return text
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter((line) => line !== '')
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const all = await adminSeoApi.show()
      global.value = { ...global.value, ...all.global }
      integrations.value = { ...integrations.value, ...all.integrations }
      pages.value = all.pages ?? []
      robots.value = { ...robots.value, ...all.robots }
      sitemap.value = { ...sitemap.value, ...all.sitemap }
      knownPaths.value = all.known_paths ?? []
      syncTextAreas()
    } catch (e: unknown) {
      error.value = describeError(e, 'Не удалось загрузить SEO-настройки')
    } finally {
      loading.value = false
    }
  }

  async function saveGlobal(): Promise<void> {
    saving.value = 'global'
    error.value = null
    try {
      const saved = await adminSeoApi.saveGlobal({ ...global.value, keywords: keywordsText.value })
      global.value = { ...global.value, ...saved }
      markSaved()
    } catch (e: unknown) {
      error.value = describeError(e, 'Не удалось сохранить глобальные настройки')
      throw e
    } finally {
      saving.value = null
    }
  }

  async function saveIntegrations(): Promise<void> {
    saving.value = 'integrations'
    error.value = null
    try {
      const saved = await adminSeoApi.saveIntegrations({ ...integrations.value })
      integrations.value = { ...integrations.value, ...saved }
      markSaved()
    } catch (e: unknown) {
      error.value = describeError(e, 'Не удалось сохранить интеграции')
      throw e
    } finally {
      saving.value = null
    }
  }

  function blankPage(path = ''): SeoPageEntry {
    return {
      path,
      title: '',
      description: '',
      keywords: '',
      og_title: '',
      og_description: '',
      og_image: '',
      canonical: '',
      robots: 'index, follow',
      enabled: true,
    }
  }

  function openCreatePage(): void {
    const unused = knownPaths.value.find((p) => !pages.value.some((row) => row.path === p))
    editingPage.value = blankPage(unused ?? '')
    editingOriginalPath.value = null
    isNewPage.value = true
    showPageDialog.value = true
  }

  function openEditPage(row: SeoPageEntry): void {
    editingPage.value = { ...row }
    editingOriginalPath.value = row.path
    isNewPage.value = false
    showPageDialog.value = true
  }

  function closePageDialog(): void {
    showPageDialog.value = false
    editingPage.value = null
    editingOriginalPath.value = null
  }

  async function savePageDialog(): Promise<void> {
    if (!editingPage.value) return
    const row = { ...editingPage.value }
    const cleanPath = row.path.trim().replace(/^\/+/, '').replace(/\/+$/, '')
    row.path = `/${cleanPath}`
    if (!row.title?.trim()) {
      error.value = 'У страницы должен быть title'
      return
    }
    const next = isNewPage.value
      ? [...pages.value, row]
      : pages.value.map((item) => (item.path === editingOriginalPath.value ? row : item))
    await persistPages(next)
    closePageDialog()
  }

  async function persistPages(next: SeoPageEntry[]): Promise<void> {
    saving.value = 'pages'
    error.value = null
    try {
      pages.value = await adminSeoApi.savePages(next)
      markSaved()
    } catch (e: unknown) {
      error.value = describeError(e, 'Не удалось сохранить страницы')
      throw e
    } finally {
      saving.value = null
    }
  }

  async function removePage(path: string): Promise<void> {
    const next = pages.value.filter((row) => row.path !== path)
    await persistPages(next)
  }

  async function togglePage(path: string, enabled: boolean): Promise<void> {
    const next = pages.value.map((row) => (row.path === path ? { ...row, enabled } : row))
    await persistPages(next)
  }

  async function saveRobots(): Promise<void> {
    saving.value = 'robots'
    error.value = null
    try {
      const saved = await adminSeoApi.saveRobots({
        ...robots.value,
        extra_disallow: splitLines(extraDisallowText.value),
        extra_allow: splitLines(extraAllowText.value),
      })
      robots.value = { ...robots.value, ...saved }
      syncTextAreas()
      markSaved()
    } catch (e: unknown) {
      error.value = describeError(e, 'Не удалось сохранить robots.txt')
      throw e
    } finally {
      saving.value = null
    }
  }

  async function saveSitemap(): Promise<void> {
    saving.value = 'sitemap'
    error.value = null
    try {
      const saved = await adminSeoApi.saveSitemap({
        ...sitemap.value,
        extra_urls: splitLines(extraUrlsText.value),
        excluded_paths: splitLines(excludedPathsText.value),
      })
      sitemap.value = { ...sitemap.value, ...saved }
      syncTextAreas()
      markSaved()
    } catch (e: unknown) {
      error.value = describeError(e, 'Не удалось сохранить sitemap.xml')
      throw e
    } finally {
      saving.value = null
    }
  }

  return {
    loading,
    saving,
    error,
    savedAt,
    knownPaths,
    global,
    integrations,
    pages,
    robots,
    sitemap,
    editingPage,
    showPageDialog,
    isNewPage,
    extraDisallowText,
    extraAllowText,
    extraUrlsText,
    excludedPathsText,
    keywordsText,
    titleLength,
    descriptionLength,
    titleOk,
    descriptionOk,
    robotsPresets: ROBOTS_PRESETS,
    load,
    saveGlobal,
    saveIntegrations,
    openCreatePage,
    openEditPage,
    closePageDialog,
    savePageDialog,
    removePage,
    togglePage,
    saveRobots,
    saveSitemap,
    blankPage,
  }
}
