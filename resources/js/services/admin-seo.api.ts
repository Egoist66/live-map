import { api } from './api'

/**
 * Типы SEO-раздела админ-панели (зеркалят SeoSettingsService на бэке).
 */
export interface SeoGlobal {
  site_name: string | null
  title_suffix: string | null
  default_title: string | null
  default_description: string | null
  keywords: string[] | string | null
  author: string | null
  locale: string | null
  og_type: string | null
  twitter_card: string | null
  twitter_site: string | null
  theme_color: string | null
  og_image: string | null
  robots_default: string | null
}

export interface SeoIntegrations {
  google_site_verification: string | null
  yandex_verification: string | null
  bing_verification: string | null
  google_analytics_id: string | null
  google_tag_manager_id: string | null
  yandex_metrica_id: string | null
  facebook_pixel_id: string | null
  vk_pixel_id: string | null
  scripts_enabled: boolean
  head_scripts: string | null
  body_start_scripts: string | null
  body_end_scripts: string | null
}

export interface SeoPageEntry {
  path: string
  title: string | null
  description: string | null
  keywords: string | null
  og_title: string | null
  og_description: string | null
  og_image: string | null
  canonical: string | null
  robots: string | null
  enabled: boolean
}

export interface SeoRobots {
  mode: 'auto' | 'custom'
  custom_text: string | null
  extra_disallow: string[]
  extra_allow: string[]
  crawl_delay: number
  sitemap_enabled: boolean
}

export interface SeoSitemap {
  enabled: boolean
  extra_urls: string[]
  excluded_paths: string[]
}

export interface SeoAll {
  global: SeoGlobal
  integrations: SeoIntegrations
  pages: SeoPageEntry[]
  robots: SeoRobots
  sitemap: SeoSitemap
  known_paths: string[]
  defaults: { title: string; description: string }
}

/**
 * API раздела SEO в админке.
 *
 * @example
 * const all = await adminSeoApi.show()
 */
export const adminSeoApi = {
  async show(): Promise<SeoAll> {
    const { data } = await api.get('/api/admin/seo')
    return data as SeoAll
  },
  async saveGlobal(payload: Partial<SeoGlobal>): Promise<SeoGlobal> {
    const { data } = await api.put('/api/admin/seo/global', payload)
    return data as SeoGlobal
  },
  async saveIntegrations(payload: Partial<SeoIntegrations>): Promise<SeoIntegrations> {
    const { data } = await api.put('/api/admin/seo/integrations', payload)
    return data as SeoIntegrations
  },
  async savePages(pages: SeoPageEntry[]): Promise<SeoPageEntry[]> {
    const { data } = await api.put('/api/admin/seo/pages', { pages })
    return data as SeoPageEntry[]
  },
  async saveRobots(payload: Partial<SeoRobots>): Promise<SeoRobots> {
    const { data } = await api.put('/api/admin/seo/robots', payload)
    return data as SeoRobots
  },
  async saveSitemap(payload: Partial<SeoSitemap>): Promise<SeoSitemap> {
    const { data } = await api.put('/api/admin/seo/sitemap', payload)
    return data as SeoSitemap
  },
}
