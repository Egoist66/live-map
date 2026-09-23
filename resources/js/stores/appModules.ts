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
  upin: { label: 'UPin карта', icon: 'pi pi-map-marker', desc: 'Пины соседей, события и помощь рядом' },
  uflow: { label: 'UFlow', icon: 'pi pi-align-justify', desc: 'Лента постов и обсуждений' },
  districts: { label: 'Районы', icon: 'pi pi-users', desc: 'Сообщества районов и новости' },
  business: { label: 'Бизнес', icon: 'pi pi-briefcase', desc: 'Кабинет компании и клиенты с карты' },
}

const STORAGE_MODULES = 'upin.app.modules'
const STORAGE_PRIMARY = 'upin.app.primary'
const LEGACY_TAB = 'welcome_landing_tab'

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
 * Новый пользователь видит только выбранный на лендинге модуль
 * (ULove ИЛИ карта ИЛИ бизнес) — без лишнего шума. Остальное
 * довключается в настройках «Приложение», в бандл летит только
 * по требованию (ленивые чанки страниц).
 *
 * Legacy: `enabled === null` — человек пользовался всем сразу
 * (поле в базе ещё не заполнено), ничего не скрываем.
 *
 * Выбор запоминается в трёх местах: localStorage (переживает
 * разлогин), сервер `enabled_modules` (другое устройство),
 * таб лендинга (гость до регистрации).
 *
 * @example const modules = useAppModulesStore(); modules.ensureInit(authUser)
 */
export const useAppModulesStore = defineStore('appModules', () => {
  const enabled = ref<AppModule[] | null>(null)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const ready = ref(false)
  const isStaff = ref(false)

  const isIsolated = computed(() => enabled.value !== null && !isStaff.value)

  const primary = computed<AppModule>(() => enabled.value?.[0] ?? 'ulove')

  const home = computed(() => MODULE_HOME[primary.value])

  /**
   * Включён ли модуль с учётом legacy-режима и staff-доступа.
   *
   * Админы и модераторы видят всё сразу — надо тестировать
   * все стороны без переключения тумблеров.
   *
   * @param module модуль для проверки
   * @returns true если виден в навигации
   */
  function isEnabled(module: AppModule): boolean {
    if (isStaff.value) {
      return true
    }

    if (enabled.value === null) {
      return true
    }

    return enabled.value.includes(module)
  }

  /**
   * Staff-признак пользователя (админ или модератор).
   *
   * @param authUser auth.user или null
   * @returns true для тестировщиков всех сторон
   */
  function staffOf(authUser: any): boolean {
    try {
      return !!authUser?.is_admin || authUser?.role === 'admin' || authUser?.role === 'moderator'
    } catch {
      return false
    }
  }

  /**
   * Домашний экран пользователя по модулям.
   *
   * Бизнес-аккаунт без модуля бизнеса стартует с primary,
   * персона — всегда с primary. Совпадает с landingPath() на бэке.
   *
   * @param accountType account_type пользователя
   * @returns путь стартового экрана
   */
  function homeFor(accountType?: string | null): string {
    if (accountType === 'business' && isEnabled('business')) {
      return MODULE_HOME.business
    }

    return MODULE_HOME[primary.value]
  }

  /**
   * Инициализация из серверного пользователя + localStorage.
   *
   * Приоритет: сервер `enabled_modules` → localStorage гостя →
   * `default_mode`/`signup_goal` → ulove. Повторные вызовы дешёвые.
   *
   * @param authUser auth.user со страницы (null для гостя)
   */
  function ensureInit(authUser: any): void {
    isStaff.value = staffOf(authUser)

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
   * Гостевая память из localStorage (таб лендинга переживает разлогин).
   */
  function loadGuestMemory(): void {
    const storedModules = readStorage(STORAGE_MODULES)
    const storedPrimary = asModule(readStorage(STORAGE_PRIMARY)) ?? legacyTabPrimary()

    if (Array.isArray(storedModules)) {
      enabled.value = cleanList(storedModules, storedPrimary ?? 'ulove')
      return
    }

    if (storedPrimary) {
      enabled.value = [storedPrimary]
      persistLocal()
      return
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
    isStaff.value = staffOf(authUser)

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
   * Запоминает выбор лендинга как набор модулей.
   *
   * Вызывается из useWelcomeMode.setTab: таб ulove/upin/business
   * превращается в изоляцию [модуль]. Переживает разлогин —
   * localStorage не чистится при logout.
   *
   * @param tab таб лендинга
   */
  function rememberLandingTab(tab: string): void {
    const module = tab === 'business' ? 'business' : asModule(tab)

    if (!module) {
      return
    }

    enabled.value = [module]
    persistLocal()
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
    const base = enabled.value === null ? [...ALL_MODULES] : [...enabled.value]
    const rest = base.filter((item) => item !== module)

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
    const base = enabled.value === null ? [...ALL_MODULES] : [...enabled.value]
    const rest = base.filter((item) => item !== module)

    enabled.value = [module, ...rest]
    persistLocal()
  }

  /**
   * Переключает модуль. Последний включённый выключить нельзя.
   *
   * @param module модуль-переключатель
   */
  async function toggle(module: AppModule): Promise<void> {
    const base = enabled.value === null ? [...ALL_MODULES] : [...enabled.value]

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
   * Пейлоад для формы регистрации: таб + модули из памяти гостя.
   *
   * @returns landing_tab и enabled_modules для POST /register
   */
  function registrationPayload(): { landing_tab: string; enabled_modules: AppModule[] } {
    const list = enabled.value ?? [legacyTabPrimary() ?? 'ulove']

    return { landing_tab: list[0], enabled_modules: list }
  }

  /**
   * Сохраняет набор: локально сразу, на сервер — для авторизованных.
   *
   * @param next новый список модулей
   */
  async function save(next: AppModule[]): Promise<void> {
    enabled.value = next
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
      const response = await axios.patch('/api/user/modules', { modules: next })
      const fresh = response.data?.modules

      if (Array.isArray(fresh)) {
        enabled.value = cleanList(fresh, next[0])
        persistLocal()
      }

      syncPageUser(next)
    } catch (err: any) {
      error.value = err?.response?.data?.message ?? 'Не получилось сохранить разделы'
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Локальное зеркало выбора (переживает разлогин).
   */
  function persistLocal(): void {
    if (enabled.value === null) {
      return
    }

    writeStorage(STORAGE_MODULES, enabled.value)
    writeStorage(STORAGE_PRIMARY, enabled.value[0])
  }

  /**
   * Проталкивает primary в auth.user страницы без перезагрузки.
   *
   * useDefaultMode читает default_mode из page props — после смены
   * модулей серверный default_mode тоже меняется, зеркалим его,
   * чтобы стартовый экран и подсказки не врали до F5.
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
   * Запасной primary по default_mode/signup_goal для legacy и гостей.
   *
   * @param authUser auth.user или null
   * @returns ulove|upin
   */
  function fallbackOf(authUser: any): AppModule {
    const raw = authUser?.default_mode

    if (raw === 'ulove' || raw === 'upin') {
      return raw
    }

    if (authUser?.signup_goal === 'neighbors') {
      return 'upin'
    }

    return legacyTabPrimary() ?? 'ulove'
  }

  /**
   * Primary из legacy-таба лендинга (миграция старых гостей).
   *
   * @returns модуль или null если таб не выбирали
   */
  function legacyTabPrimary(): AppModule | null {
    try {
      if (typeof window === 'undefined') {
        return null
      }

      const stored = window.localStorage.getItem(LEGACY_TAB)

      if (stored === 'business') {
        return 'business'
      }

      return asModule(stored)
    } catch {
      return null
    }
  }

  return {
    enabled,
    saving,
    error,
    ready,
    isIsolated,
    primary,
    home,
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
