import { computed, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import {
  LANDING_CONTENT,
  LANDING_HEADER_TAGS,
  LANDING_SEO,
  LANDING_TAB_OPTIONS,
  LANDING_THEMES,
  PIN_CHIPS,
  PIN_SAMPLES,
  brandFor,
  buildLandingSeo,
  landingTabsFor,
  type LandingTabId,
} from '@/composables/useModuleContent'
import { useAppModulesStore } from '@/stores/appModules'

/**
 * Вкладка стартовой страницы: ULove всегда, карта — после выпуска.
 *
 * @deprecated Табы теперь вычисляются из глобальных модулей
 * (см. useModuleContent): доступен и ULove, и карта — только
 * когда админ включил upin. Алиас оставлен для совместимости.
 */
export type LandingTab = LandingTabId

const tab = ref<LandingTabId>('ulove')

const THUMB_GRADIENT: Record<LandingTabId, string> = {
  ulove: 'bg-gradient-to-r from-rose-400 via-fuchsia-400 to-orange-300',
  upin: 'bg-gradient-to-r from-rose-400 via-pink-400 to-orange-300',
}

const THUMB_POSITION: Record<LandingTabId, string> = {
  ulove: 'translate-x-0',
  upin: 'translate-x-full',
}

/**
 * Переключатель стартовой страницы на движке модулей.
 *
 * Табы, контент, тема, CTA и SEO собираются из глобально включённых
 * модулей: админ выпустил карту — таб «UPin · карта» и её тексты
 * появились сами. Выбранный таб живёт только в памяти вкладки.
 *
 * @returns активная вкладка, контент и палитра, CTA под неё
 * @example const landing = useWelcomeMode()
 */
export function useWelcomeMode() {
  const page = usePage()
  const store = useAppModulesStore()

  try {
    const raw = (page.props as unknown as { globalModules?: unknown }).globalModules

    if (raw !== undefined) {
      store.applyGlobal(raw)
    }
  } catch {
    // No-op: стор держит дефолт ['ulove'].
  }

  try {
    watch(
      () => (page.props as unknown as { globalModules?: unknown }).globalModules,
      (next) => {
        if (next !== undefined) {
          try {
            store.applyGlobal(next)
          } catch {
            // No-op: стор сам держит дефолт ULove.
          }
        }
      },
    )
  } catch {
    // No-op: без реактивности останется стартовый набор.
  }

  const authUser = computed(() => ((page.props as any).auth as any)?.user ?? null)
  const isAuthenticated = computed(() => !!authUser.value)

  const availableTabs = computed<LandingTabId[]>(() => landingTabsFor(store.globalEnabled))

  const tabOptions = computed(() => LANDING_TAB_OPTIONS.filter((opt) => availableTabs.value.includes(opt.value)))

  try {
    watch(
      availableTabs,
      (tabs) => {
        if (!tabs.includes(tab.value)) {
          tab.value = 'ulove'
        }
      },
      { immediate: true },
    )
  } catch {
    // No-op: таб и так ulove по умолчанию.
  }

  const isUlove = computed(() => tab.value === 'ulove')
  const showTabs = computed(() => availableTabs.value.length > 1)
  const brand = computed(() => brandFor(store.globalEnabled))
  const content = computed(() => LANDING_CONTENT[tab.value])
  const theme = computed(() => LANDING_THEMES[tab.value])
  const headerTag = computed(() => LANDING_HEADER_TAGS[tab.value])

  const headerTagClass = computed(() =>
    isUlove.value
      ? 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400'
      : 'bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400',
  )

  const primaryCta = computed(() => {
    if (!isAuthenticated.value) {
      return { href: '/login', label: isUlove.value ? 'Создать анкету ULove →' : 'Попробовать ULove + карту →' }
    }
    return isUlove.value ? { href: '/swipes', label: 'Открыть ULove →' } : { href: '/map', label: 'Открыть карту →' }
  })

  /**
   * Мета-теги: SEO активного таба; общий фолбэк — по всем табам.
   */
  const seo = computed(() => {
    if (availableTabs.value.length > 1) {
      return buildLandingSeo(availableTabs.value)
    }

    return { ...LANDING_SEO[tab.value] }
  })

  /**
   * Переключает таб только в памяти среди выпущенных разделов.
   *
   * @param next ulove|upin (невыпущенный таб игнорируется)
   */
  function setTab(next: LandingTabId | string): void {
    const clean = next === 'upin' ? 'upin' : 'ulove'

    if (!availableTabs.value.includes(clean)) {
      return
    }

    tab.value = clean
  }

  return {
    tab,
    availableTabs,
    showTabs,
    brand,
    tabOptions,
    thumbGradient: THUMB_GRADIENT,
    thumbPosition: THUMB_POSITION,
    isUlove,
    content,
    theme,
    headerTag,
    headerTagClass,
    primaryCta,
    seo,
    isAuthenticated,
    setTab,
    pinSamples: PIN_SAMPLES,
    pinChips: PIN_CHIPS,
  }
}

/**
 * Совместимость: механика запоминания убрана, всегда null.
 *
 * @returns всегда null — выбора больше не запоминаем
 */
export function readLandingTab(): LandingTab | null {
  return null
}
