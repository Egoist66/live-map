import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import axios from 'axios'

/**
 * Модуль приложения: изолируемый раздел (ULove, карта, лента, районы, бизнес).
 */
export type AppModule = 'ulove' | 'upin' | 'uflow' | 'districts' | 'business'

/** Все модули в каноническом порядке. */
export const ALL_MODULES: readonly AppModule[] = ['ulove', 'upin', 'uflow', 'districts', 'business']

/** Стартовый экран каждого модуля. */
export const MODULE_HOME: Record<AppModule, string> = {
  ulove: '/swipes',
  upin: '/map',
  uflow: '/flow',
  districts: '/districts',
  business: '/cabinet',
}

/** Метаданные для настроек «Приложение»: подпись, иконка, пояснение. */
export const MODULE_META: Record<AppModule, { label: string; icon: string; desc: string }> = {
  ulove: { label: 'ULove', icon: 'pi pi-heart-fill', desc: 'Знакомства рядом: свайпы, мэтчи, чаты' },
  upin: { label: 'Карта', icon: 'pi pi-map-marker', desc: 'Пины и события рядом — выключена по умолчанию' },
  uflow: { label: 'UFlow', icon: 'pi pi-align-justify', desc: 'Лента постов и обсуждений' },
  districts: { label: 'Районы', icon: 'pi pi-users', desc: 'Сообщества районов и новости' },
  business: { label: 'Бизнес', icon: 'pi pi-briefcase', desc: 'Кабинет компании и клиенты с карты' },
}

const STORAGE_MODULES = 'upin.app.modules'
const STORAGE_PRIMARY = 'upin.app.primary'
const LEGACY_TAB = 'welcome_landing_tab'
/**
 * Ядро без гарда модулей: безопасный дом для бизнеса без кабинета.
 * Совпадает с `User::landingPath()` на бэке (там `route('chat')`).
 */
const CHAT_HOME = '/chat'
/**
 * Cookie выбранной стороны для SSR: сервер не видит localStorage,
 * а без подсказки рендерит тему по умолчанию — отсюда флеш чужой
 * темы и mismatch гидратации на входе/регистрации.
 */
const COOKIE_SIDE = 'upin_side'

/**
 * Проверяет значение на принадлежность к модулям.
 *
 * @param value сырое значение
 * @returns модуль или null
 */
function asModule(value: unknown): AppModule | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()

  const found = ALL_MODULES.find((module) => module === normalized)

  return found ?? null
}

/**
 * Чистит список модулей: только известные, без дублей, минимум один.
 *
 * @param raw сырой список
 * @param fallback запасной primary при пустом списке
 * @returns чистый список
 */
function cleanList(raw: unknown, fallback: AppModule): AppModule[] {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<AppModule>()
  const clean: AppModule[] = []

  for (const item of list) {
    const module = asModule(item)

    if (module && !seen.has(module)) {
      seen.add(module)
      clean.push(module)
    }
  }

  if (clean.length > 0) {
    return clean
  }

  return [fallback]
}

/**
 * Читает JSON из localStorage без падений (SSR/private mode safe).
 *
 * @param key ключ
 * @returns распарсенное значение или null
 */
function readStorage(key: string): unknown {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    const raw = window.localStorage.getItem(key)

    if (!raw) {
      return null
    }

    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Пишет JSON в localStorage без падений.
 *
 * @param key ключ
 * @param value значение
 */
function writeStorage(key: string, value: unknown): void {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
  }
}

/**
 * Стор изоляции модулей: какая сторона приложения включена.
 *
 * Новые пользователи получают ULove. Механика запоминания таба
 * лендинга убрана: выбор таба на стартовой странице ни на что не
 * влияет, всегда ULove по дефолту. Остальное довключается в
 * настройках «Приложение», в бандл летит только по требованию
 * (ленивые чанки страниц).
 *
 * Legacy: `enabled === null` — человек пользовался всем сразу
 * (поле в базе ещё не заполнено), ничего не скрываем.
 *
 * @example const modules = useAppModulesStore(); modules.ensureInit(authUser)
 */
export const useAppModulesStore = defineStore('appModules', () => {
  const enabled = ref<AppModule[] | null>(null)
  /** Глобально включённые админом разделы. По умолчанию только ULove. */
  const globalEnabled = ref<AppModule[]>(['ulove'])
  const saving = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)

  const isIsolated = computed(() => enabled.value !== null)

  /**
   * Стартовый модуль: первый ГЛОБАЛЬНО включённый в списке.
   *
   * Старые списки могут указывать на выключенный админом раздел —
   * такой primary вёл гард и сервер по кругу (редирект на закрытый
   * раздел и обратно). Фолбэк — всегда доступный ULove.
   */
  const primary = computed<AppModule>(() => {
    const list = enabled.value ?? [...ALL_MODULES]
    const visible = list.filter((item) => isGloballyEnabled(item))

    return visible[0] ?? 'ulove'
  })

  const home = computed(() => MODULE_HOME[primary.value])

  /**
   * Применяет глобальный набор с сервера (Inertia `globalModules`).
   *
   * ULove принудительно первый: выключить его нельзя даже админу.
   *
   * @param raw сырой список с сервера
   */
  function applyGlobal(raw: unknown): void {
    const clean = cleanList(raw, 'ulove')

    if (!clean.includes('ulove')) {
      clean.unshift('ulove')
    }

    globalEnabled.value = clean
  }

  /**
   * Включён ли модуль глобально администратором.
   *
   * @param module модуль для проверки
   * @returns true если раздел разрешён глобально (ulove — всегда)
   */
  function isGloballyEnabled(module: AppModule): boolean {
    if (module === 'ulove') {
      return true
    }

    return globalEnabled.value.includes(module)
  }

  /**
   * Включён ли модуль с учётом legacy-режима и глобального гейта.
   *
   * Глобально выключенный раздел скрыт везде: навигация, настройки,
   * чанки не грузятся. Legacy (`enabled === null`) видит только
   * глобально включённые разделы.
   *
   * @param module модуль для проверки
   * @returns true если виден в навигации
   */
  function isEnabled(module: AppModule): boolean {
    if (!isGloballyEnabled(module)) {
      return false
    }

    if (enabled.value === null) {
      return true
    }

    return enabled.value.includes(module)
  }

  /**
   * Домашний экран пользователя по модулям.
   *
   * Бизнес-аккаунт без доступного модуля бизнеса едет в чаты ядра
   * (как `landingPath()` на бэке), а не на свайпы: сервер всё равно
   * развернул бы его оттуда. Персона — всегда на свой доступный
   * primary. Совпадает с landingPath() на бэке, петель нет.
   *
   * @param accountType account_type пользователя
   * @returns путь стартового экрана
   */
  function homeFor(accountType?: string | null): string {
    if (accountType === 'business') {
      if (isEnabled('business')) {
        return MODULE_HOME.business
      }

      return CHAT_HOME
    }

    return MODULE_HOME[primary.value]
  }

  /**
   * Инициализация из серверного пользователя + глобального гейта.
   *
   * Глобальный набор читается из `page.props.globalModules` при каждом
   * вызове: админ мог включить раздел без перезагрузки страницы.
   * Приоритет персонального набора: сервер `enabled_modules` → legacy.
   * Гость — только ULove в памяти, без localStorage.
   *
   * @param authUser auth.user со страницы (null для гостя)
   */
  function ensureInit(authUser: any): void {
    syncGlobalFromPage()

    if (ready.value) {
      syncUserRef(authUser)
      return
    }

    ready.value = true

    const serverList = authUser?.enabled_modules

    if (Array.isArray(serverList)) {
      const fallback = fallbackOf(authUser)
      enabled.value = cleanList(serverList, fallback)
      persistLocal()
      return
    }

    if (authUser) {
      enabled.value = null
      return
    }

    loadGuestMemory()
  }

  /**
   * Подтягивает глобальный набор из пропсов Inertia без перезагрузки.
   *
   * Вызывается из ensureInit/syncUserRef: вложений в localStorage нет,
   * источник правды — сервер (`HandleInertiaRequests::share`).
   */
  function syncGlobalFromPage(): void {
    try {
      const w = window as unknown as { __inertia_page?: { props?: { globalModules?: unknown } } }
      const raw = w.__inertia_page?.props?.globalModules

      if (raw !== undefined) {
        applyGlobal(raw)
        return
      }
    } catch {
      // No-op: фолбэк ниже.
    }

    try {
      const doc = document?.querySelector?.('#app')?.getAttribute?.('data-page')

      if (doc) {
        const parsed = JSON.parse(doc) as { props?: { globalModules?: unknown } }
        const raw = parsed?.props?.globalModules

        if (raw !== undefined) {
          applyGlobal(raw)
        }
      }
    } catch {
      // No-op: остаётся дефолт ['ulove'].
    }
  }

  /**
   * Гостевая память: изоляция выключена.
   *
   * Таб лендинга больше не запоминается и не влияет на модули:
   * новичок после регистрации получает ULove с сервера. Старые
   * ключи localStorage чистим, чтобы не тянуть чужой primary
   * из прошлого.
   */
  function loadGuestMemory(): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_MODULES)
        window.localStorage.removeItem(STORAGE_PRIMARY)
        window.localStorage.removeItem(LEGACY_TAB)
      }
    } catch {
    }
    try {
      if (typeof document !== 'undefined') {
        document.cookie = `${COOKIE_SIDE}=ulove; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`
      }
    } catch {
    }
    enabled.value = null
  }

  /**
   * Подтягивает свежий enabled_modules после навигации Inertia.
   *
   * Inertia меняет auth.user без перезагрузки — стор бы остался
   * со старым набором (например после логина другим аккаунтом
   * или разлогина: сбрасываем staff и гостевую память).
   *
   * @param authUser свежий auth.user
   */
  function syncUserRef(authUser: any): void {
    syncGlobalFromPage()

    if (!authUser) {
      loadGuestMemory()
      return
    }

    const serverList = authUser?.enabled_modules

    if (!Array.isArray(serverList)) {
      return
    }

    const fallback = fallbackOf(authUser)
    const clean = cleanList(serverList, fallback)
    const current = enabled.value

    const same = current !== null && current.length === clean.length && current.every((item, index) => item === clean[index])

    if (!same) {
      enabled.value = clean
      persistLocal()
    }
  }

  /**
   * Совместимость: запоминание таба лендинга убрано.
   *
   * Оставлена как no-op, чтобы старые вызовы не падали:
   * выбор таба ни на что не влияет, всегда ULove по дефолту.
   *
   * @param tab таб лендинга (игнорируется)
   */
  function rememberLandingTab(tab: string): void {
    return
  }

  /**
   * Делает модуль стартовым (первым в списке).
   *
   * В legacy-режиме сначала разворачивает все модули в явный
   * список, чтобы включение изоляции не выключало остальное молча.
   *
   * @param module новый primary
   */
  async function setPrimary(module: AppModule): Promise<void> {
    if (!isGloballyEnabled(module)) {
      return
    }

    const visibleBase = (enabled.value === null ? [...ALL_MODULES] : [...enabled.value]).filter((item) => isGloballyEnabled(item))
    const rest = visibleBase.filter((item) => item !== module)

    await save([module, ...rest])
  }

  /**
   * Локально принимает primary без запроса на сервер.
   *
   * Для связки со старым API `PATCH /api/user/default-mode`
   * (модалка первого выбора): сервер уже сохранил
   * default_mode, стору остаётся переставить primary и зеркало.
   *
   * @param module новый primary (ulove|upin)
   */
  function adoptPrimaryLocal(module: AppModule): void {
    if (!isGloballyEnabled(module)) {
      return
    }

    const visibleBase = (enabled.value === null ? [...ALL_MODULES] : [...enabled.value]).filter((item) => isGloballyEnabled(item))
    const rest = visibleBase.filter((item) => item !== module)

    enabled.value = [module, ...rest]
    persistLocal()
  }

  /**
   * Переключает модуль. Последний включённый выключить нельзя.
   *
   * @param module модуль-переключатель
   */
  async function toggle(module: AppModule): Promise<void> {
    if (module === 'ulove' || !isGloballyEnabled(module)) {
      return
    }

    const visibleBase = (enabled.value === null ? [...ALL_MODULES] : [...enabled.value]).filter((item) => isGloballyEnabled(item))
    const base = visibleBase.length > 0 ? visibleBase : ['ulove' as AppModule]

    if (base.includes(module)) {
      if (base.length <= 1) {
        return
      }

      await save(base.filter((item) => item !== module))
      return
    }

    await save([...base, module])
  }

  /**
   * Пейлоад для формы регистрации: ULove + всё глобально включённое.
   *
   * Бэк всё равно собирает список сам из глобального набора,
   * но фронт шлёт честный текущий набор вместо захардкоженного.
   * ULove принудительно первый: applyGlobal так чистит любой вход.
   *
   * @returns landing_tab и enabled_modules для POST /register
   */
  function registrationPayload(): { landing_tab: string; enabled_modules: AppModule[] } {
    const modules = globalEnabled.value.length > 0 ? [...globalEnabled.value] : (['ulove'] as AppModule[])

    return { landing_tab: 'ulove', enabled_modules: modules }
  }

  /**
   * Сохраняет набор: локально сразу, на сервер — для авторизованных.
   *
   * ULove — базовый раздел: принудительно первый в списке, снять
   * его нельзя (бэк делает то же самое для не-бизнеса).
   *
   * @param next новый список модулей
   */
  async function save(next: AppModule[]): Promise<void> {
    const visibleNext = next.filter((item) => isGloballyEnabled(item))
    const withBase = visibleNext.includes('ulove') ? visibleNext : (['ulove', ...visibleNext] as AppModule[])
    const safeNext = withBase.length > 0 ? withBase : (['ulove'] as AppModule[])

    enabled.value = safeNext
    persistLocal()

    try {
      const { usePage } = await import('@inertiajs/vue3')
      const authUser = (usePage().props as any)?.auth?.user ?? null

      if (!authUser) {
        return
      }
    } catch {
      return
    }

    saving.value = true
    error.value = null

    try {
      const response = await axios.patch('/api/user/modules', { modules: safeNext })
      const freshGlobal = response.data?.global_modules

      if (Array.isArray(freshGlobal)) {
        applyGlobal(freshGlobal)
      }

      const fresh = response.data?.modules

      if (Array.isArray(fresh)) {
        enabled.value = cleanList(fresh, safeNext[0])
        persistLocal()
      }

      syncPageUser(safeNext)
    } catch (err: any) {
      error.value = err?.response?.data?.message ?? 'Не получилось сохранить разделы'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Пишет выбранную сторону в cookie для SSR (см. COOKIE_SIDE).
   *
   * @param primary стартовый модуль
   */
  function writeSideCookie(primary: AppModule): void {
    try {
      if (typeof document === 'undefined') {
        return
      }

      const oneYear = 60 * 60 * 24 * 365

      document.cookie = `${COOKIE_SIDE}=${primary}; Max-Age=${oneYear}; Path=/; SameSite=Lax`
    } catch {
    }
  }

  /**
   * Локальное зеркало выбора (переживает разлогин).
   *
   * Заодно зеркалит primary в cookie, чтобы сервер и SSR
   * сразу рендерили правильную тему auth-страниц без флеша.
   */
  function persistLocal(): void {
    if (enabled.value === null) {
      return
    }

    writeStorage(STORAGE_MODULES, enabled.value)
    writeStorage(STORAGE_PRIMARY, enabled.value[0])
    writeSideCookie(enabled.value[0])
  }

  /**
   * Проталкивает primary в auth.user страницы без перезагрузки.
   *
   * Legacy default_mode читается из page props — после смены модулей
   * серверное поле тоже меняется, зеркалим его, чтобы совместимые
   * экраны не врали до F5.
   *
   * @param next свежий список модулей
   */
  async function syncPageUser(next: AppModule[]): Promise<void> {
    try {
      const { usePage } = await import('@inertiajs/vue3')
      const authUser = (usePage().props as any)?.auth?.user ?? null

      if (!authUser) {
        return
      }

      authUser.enabled_modules = [...next]

      if (next[0] === 'ulove' || next[0] === 'upin') {
        authUser.default_mode = next[0]
        authUser.default_mode_set_at = new Date().toISOString()
      }
    } catch {
    }
  }

  /**
   * Запасной primary: всегда ULove.
   *
   * @param authUser auth.user или null (игнорируется)
   * @returns всегда ulove
   */
  function fallbackOf(authUser: any): AppModule {
    return 'ulove'
  }

  /**
   * Совместимость: таб лендинга больше не читается.
   *
   * @returns всегда null
   */
  function legacyTabPrimary(): AppModule | null {
    return null
  }

  return {
    enabled,
    globalEnabled,
    saving,
    error,
    ready,
    isIsolated,
    primary,
    home,
    applyGlobal,
    isGloballyEnabled,
    isEnabled,
    homeFor,
    ensureInit,
    syncUserRef,
    rememberLandingTab,
    setPrimary,
    adoptPrimaryLocal,
    toggle,
    registrationPayload,
    save,
  }
})
