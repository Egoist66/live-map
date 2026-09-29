import { ref, watch } from 'vue'

/**
 * ID главной вкладки админ-панели.
 */
export type AdminTabId = 'stats' | 'manage' | 'security' | 'admin' | 'business' | 'refs' | 'seo' | 'telegram'

/**
 * ID подвкладки SEO-центра (активна только при `tab === 'seo'`).
 */
export type AdminSeoSection = 'general' | 'pages' | 'integrations' | 'scripts' | 'crawl'

/**
 * Допустимые значения `?tab=` в URL админ-панели.
 */
export const ADMIN_TABS: readonly AdminTabId[] = [
  'stats',
  'manage',
  'security',
  'admin',
  'business',
  'refs',
  'seo',
  'telegram',
]

/**
 * Допустимые значения `?seo=` в URL админ-панели.
 */
export const ADMIN_SEO_SECTIONS: readonly AdminSeoSection[] = [
  'general',
  'pages',
  'integrations',
  'scripts',
  'crawl',
]

const DEFAULT_TAB: AdminTabId = 'stats'
const DEFAULT_SEO_SECTION: AdminSeoSection = 'general'

const tab = ref<AdminTabId>(DEFAULT_TAB)
const seoSection = ref<AdminSeoSection>(DEFAULT_SEO_SECTION)

let initialized = false

/**
 * Проверка значения главного таба.
 *
 * @param value Сырое значение из URL.
 * @returns True если это допустимый таб админки.
 */
function isAdminTab(value: unknown): value is AdminTabId {
  if (typeof value !== 'string') {
    return false
  }

  return (ADMIN_TABS as readonly string[]).includes(value)
}

/**
 * Проверка значения SEO-подвкладки.
 *
 * @param value Сырое значение из URL.
 * @returns True если это допустимая SEO-секция.
 */
function isSeoSection(value: unknown): value is AdminSeoSection {
  if (typeof value !== 'string') {
    return false
  }

  return (ADMIN_SEO_SECTIONS as readonly string[]).includes(value)
}

/**
 * Прочитать `?tab=` и `?seo=` из адресной строки.
 *
 * Невалидные значения откатываются к дефолтам,
 * отсутствующие — тоже (перезагрузка всегда открывает валидное место).
 */
function readFromUrl(): void {
  if (typeof window === 'undefined') {
    return
  }

  const params = new URLSearchParams(window.location.search)

  const rawTab = params.get('tab')
  tab.value = isAdminTab(rawTab) ? rawTab : DEFAULT_TAB

  const rawSeo = params.get('seo')
  seoSection.value = isSeoSection(rawSeo) ? rawSeo : DEFAULT_SEO_SECTION
}

/**
 * Записать текущие табы в адресную строку без перезагрузки.
 *
 * `seo` храним только когда открыт таб `seo`,
 * чтобы URL вида `?tab=stats&seo=scripts` не смущал.
 */
function syncToUrl(): void {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)

  url.searchParams.set('tab', tab.value)

  if (tab.value === 'seo') {
    url.searchParams.set('seo', seoSection.value)
  } else {
    url.searchParams.delete('seo')
  }

  window.history.replaceState({}, '', url.toString())
}

/**
 * Однократно подписаться на изменения табов и кнопку назад/вперёд.
 */
function ensureSync(): void {
  if (initialized) {
    return
  }

  initialized = true

  readFromUrl()
  syncToUrl()

  watch(tab, syncToUrl)
  watch(seoSection, syncToUrl)

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', readFromUrl)
  }
}

/**
 * Хук вкладок админ-панели, синхронизированных с query-параметрами.
 *
 * Главный таб живёт в `?tab=stats|manage|security|admin|refs|seo|telegram`,
 * подвкладка SEO-центра — в `?seo=general|pages|integrations|scripts|crawl`.
 * Состояние общее (module-level), поэтому `Admin/Index.vue` и
 * `AdminSeoManager.vue` видят одни и те же табы, а перезагрузка
 * страницы открывает то место, где был пользователь.
 *
 * @returns Текущие табы и сеттеры с валидацией.
 * @example
 * const { tab, seoSection, setTab, setSeoSection } = useAdminTabs()
 * setTab('seo')
 * setSeoSection('scripts')
 */
export function useAdminTabs() {
  ensureSync()

  /**
   * Переключить главный таб админки.
   *
   * @param next Новый таб.
   */
  function setTab(next: AdminTabId): void {
    if (!isAdminTab(next)) {
      return
    }

    tab.value = next
  }

  /**
   * Переключить подвкладку SEO-центра.
   *
   * @param next Новая SEO-секция.
   */
  function setSeoSection(next: AdminSeoSection): void {
    if (!isSeoSection(next)) {
      return
    }

    seoSection.value = next
  }

  return {
    tab,
    seoSection,
    setTab,
    setSeoSection,
  }
}
