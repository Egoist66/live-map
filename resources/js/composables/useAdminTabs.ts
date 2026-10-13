import { ref, watch } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { replaceUrlPreservingState } from '@/composables/useHistoryState'

/**
 * ID главной вкладки админ-панели.
 */
export type AdminTabId = 'stats' | 'manage' | 'security' | 'admin' | 'business' | 'modules' | 'ai' | 'refs' | 'seo' | 'telegram' | 'payments'

/**
 * ID подвкладки SEO-центра (активна только при `tab === 'seo'`).
 */
export type AdminSeoSection = 'general' | 'pages' | 'integrations' | 'scripts' | 'crawl'

/**
 * Допустимые разделы консоли в URL (`/admin/stats`, `/admin/business`…).
 */
export const ADMIN_TABS: readonly AdminTabId[] = [
  'stats',
  'manage',
  'security',
  'admin',
  'business',
  'modules',
  'ai',
  'refs',
  'seo',
  'telegram',
  'payments',
]

/**
 * Допустимые подразделы SEO-центра (`/admin/seo/scripts`…).
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
 * Канонический путь раздела консоли.
 *
 * @param next Раздел консоли.
 * @param nextSeo Подраздел SEO-центра (только для `seo`).
 * @returns Путь вида `/admin/stats` или `/admin/seo/scripts`.
 */
export function adminSectionUrl(next: AdminTabId, nextSeo: AdminSeoSection = DEFAULT_SEO_SECTION): string {
  if (next === 'seo') {
    return `/admin/seo/${nextSeo}`
  }

  return `/admin/${next}`
}

/**
 * Открыть консоль в отдельной вкладке браузера.
 *
 * Вызывается по клику на «Панель модерации» (меню, профиль): текущая
 * страница остаётся нетронутой. Если всплывающие окна заблокированы —
 * уходим в раздел в текущей вкладке, чтобы клик не был мёртвым.
 *
 * @param next Раздел консоли (по умолчанию статистика).
 * @param nextSeo Подраздел SEO-центра.
 */
export function openAdminPanel(next: AdminTabId = DEFAULT_TAB, nextSeo: AdminSeoSection = DEFAULT_SEO_SECTION): void {
  if (typeof window === 'undefined') {
    return
  }

  const target = adminSectionUrl(next, nextSeo)
  const opened = window.open(target, '_blank', 'noopener,noreferrer')

  if (!opened) {
    router.visit(target)
  }
}

/**
 * Этот URL — страница консоли?
 */
function isAdminPath(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return new URL(window.location.href).pathname.startsWith('/admin')
  } catch {
    return false
  }
}

/**
 * Разобрать сегменты пути консоли.
 *
 * @returns Таб и SEO-секция из пути (`null` — сегмент пуст или мусор).
 */
function parseAdminPath(): { pathTab: AdminTabId | null; pathSeo: AdminSeoSection | null } {
  try {
    const segments = new URL(window.location.href).pathname.split('/').filter(Boolean)

    if (segments[0] !== 'admin') {
      return { pathTab: null, pathSeo: null }
    }

    const rawTab = segments[1] ?? null
    const rawSeo = segments[2] ?? null

    return {
      pathTab: isAdminTab(rawTab) ? rawTab : null,
      pathSeo: isSeoSection(rawSeo) ? rawSeo : null,
    }
  } catch {
    return { pathTab: null, pathSeo: null }
  }
}

/**
 * Начальные пропсы сервера для SSR.
 *
 * На сервере `window` нет — первый рендер берёт раздел из пропсов
 * (`initialTab`/`initialSeoSection` из `PageController::admin`), чтобы
 * прямая ссылка `/admin/business` сразу рисовала нужный раздел.
 */
function readInitialProps(): void {
  try {
    const props = usePage().props as unknown as { initialTab?: unknown; initialSeoSection?: unknown }

    if (isAdminTab(props.initialTab)) {
      tab.value = props.initialTab
    }

    if (isSeoSection(props.initialSeoSection)) {
      seoSection.value = props.initialSeoSection
    }
  } catch {
    // No-op: вне setup-контекста пропсов нет.
  }
}

/**
 * Прочитать раздел из адресной строки.
 *
 * Источник правды — path (`/admin/business`, `/admin/seo/scripts`).
 * Старые `?tab=`/`?seo=` (закладки, уже отправленные пуши) понимаем как
 * запасной вариант, когда в пути раздела нет, — `syncToUrl` тут же
 * канонизирует адрес в path-вид. Голый `/admin` не трогает запомненный
 * раздел: ссылка дописывается им позже в `syncToUrl`.
 * Вне `/admin` (кнопка назад на профиль, popstate) — ничего не трогаем:
 * иначе возврат из консоли молча сбрасывал бы запомненный раздел.
 */
function readFromUrl(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!isAdminPath()) {
    return
  }

  const { pathTab, pathSeo } = parseAdminPath()

  if (pathTab) {
    tab.value = pathTab
    seoSection.value = pathTab === 'seo' ? (pathSeo ?? DEFAULT_SEO_SECTION) : seoSection.value
    return
  }

  const params = new URLSearchParams(window.location.search)
  const legacyTab = params.get('tab')
  const legacySeo = params.get('seo')

  if (isAdminTab(legacyTab)) {
    tab.value = legacyTab
  }

  if (tab.value === 'seo' && isSeoSection(legacySeo)) {
    seoSection.value = legacySeo
    return
  }

  if (tab.value === 'seo' && pathSeo) {
    seoSection.value = pathSeo
  }
}

/**
 * Записать текущий раздел в адресную строку без перезагрузки.
 *
 * Путь всегда канонический (`/admin/stats`, `/admin/seo/scripts`),
 * остатки `?tab=`/`?seo=` вычищаем. Остальные query-параметры не трогаем.
 *
 * Важно для Inertia: состояние истории (`history.state`) сохраняем как есть.
 * Inertia хранит в нём данные страницы для кнопки назад/вперёд — прежний
 * `replaceState({}, ...)` затирал его пустым объектом, и возврат назад
 * (админка ↔ профиль) давал пустой экран до ручной перезагрузки.
 */
function syncToUrl(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (!isAdminPath()) {
    return
  }

  const url = new URL(window.location.href)
  url.pathname = adminSectionUrl(tab.value, seoSection.value)
  url.searchParams.delete('tab')
  url.searchParams.delete('seo')

  if (url.toString() === window.location.href) {
    return
  }

  replaceUrlPreservingState(url.toString())
}

/**
 * Подхватить раздел из адресной строки при каждом переходе.
 *
 * Inertia не пересоздаёт страницу при переходах внутри `/admin`,
 * поэтому одноразового чтения URL мало: диплинки (уведомления,
 * колокольчик) меняли адрес, а раздел оставался старым. Каждый переход
 * по `/admin` перечитывает адрес, голый `/admin` дописывает текущий
 * раздел — ссылка всегда ведёт туда же (обновить/поделиться — то же место).
 */
function handleNavigate(): void {
  if (!isAdminPath()) {
    return
  }

  readFromUrl()
  syncToUrl()
}

/**
 * Нужна ли первичная запись раздела в адресную строку.
 *
 * Голый `/admin`, мусор в сегментах или остатки `?tab=` — дописываем
 * канонический путь запомненным разделом. Чистый path-URL не трогаем
 * вовсе — лишних `replaceState` посреди коммита Inertia нет.
 *
 * @returns true если адрес не канонический
 */
function needsUrlSync(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  if (!isAdminPath()) {
    return false
  }

  const url = new URL(window.location.href)
  const canonicalPath = adminSectionUrl(tab.value, seoSection.value)

  if (url.pathname !== canonicalPath) {
    return true
  }

  return url.searchParams.has('tab') || url.searchParams.has('seo')
}

/**
 * Однократно подписаться на изменения табов, переходы и кнопку назад/вперёд.
 */
function ensureSync(): void {
  if (initialized) {
    return
  }

  initialized = true

  if (typeof window === 'undefined') {
    readInitialProps()
    return
  }

  readInitialProps()
  readFromUrl()

  if (needsUrlSync()) {
    // Микрозадача, а не синхронно: ensureSync бежит в setup страницы,
    // посреди коммита Inertia — историю правим после него, а не внутри.
    queueMicrotask(() => syncToUrl())
  }

  watch(tab, syncToUrl)
  watch(seoSection, syncToUrl)

  window.addEventListener('popstate', handleNavigate)

  try {
    router.on('navigate', handleNavigate)
  } catch {
    // SSR: роутера нет.
  }
}

/**
 * Хук вкладок админ-панели, синхронизированных с path-параметрами.
 *
 * Главный таб живёт в пути (`/admin/stats`, `/admin/business`),
 * подвкладка SEO-центра — вторым сегментом (`/admin/seo/scripts`).
 * Состояние общее (module-level), поэтому `Admin/Index.vue` и
 * `AdminSeoManager.vue` видят одни и те же табы, а перезагрузка,
 * кнопка назад/вперёд и прямая ссылка открывают то место, куда ведут.
 * Каждый переход по /admin перечитывает адрес (диплинки в SPA работают),
 * голый /admin дописывает текущий раздел — ссылка всегда ведёт туда же.
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
