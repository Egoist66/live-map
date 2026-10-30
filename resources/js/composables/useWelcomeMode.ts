import { computed, ref, watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import {
  LANDING_CONTENT,
  LANDING_HEADER_TAGS,
  LANDING_SEO,
  LANDING_TAB_OPTIONS,
  LANDING_THEMES,
  brandFor,
  buildLandingSeo,
  landingTabsFor,
  type LandingTabId,
} from '@/composables/useModuleContent'
import { useAppModulesStore } from '@/stores/appModules'

/**
 * Вкладка стартовой страницы.
 *
 * @deprecated Публичная витрина всегда ULove; алиас оставлен
 * для совместимости с существующими импортами.
 */
export type LandingTab = LandingTabId

const tab = ref<LandingTabId>('ulove')

const THUMB_GRADIENT: Record<LandingTabId, string> = {
  ulove: 'bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500',
}

const THUMB_POSITION: Record<LandingTabId, string> = {
  ulove: 'translate-x-0',
}

/**
 * Состояние стартовой страницы.
 *
 * Витрина только ULove: контент, тема, CTA и SEO собраны из одного
 * источника `useModuleContent`. Дополнительные модули (карта, лента,
 * районы, бизнес) на лендинг не выносятся и в текстах не упоминаются.
 *
 * @returns контент, палитра, CTA и SEO стартовой страницы
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

  const isUlove = computed(() => tab.value === 'ulove')
  const showTabs = computed(() => availableTabs.value.length > 1)
  const brand = computed(() => brandFor(store.globalEnabled))
  const content = computed(() => LANDING_CONTENT[tab.value])
  const theme = computed(() => LANDING_THEMES[tab.value])
  const headerTag = computed(() => LANDING_HEADER_TAGS[tab.value])

  const headerTagClass = 'bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500'

  const primaryCta = computed(() => {
    if (!isAuthenticated.value) {
      return { href: '/login', label: 'Создать анкету ULove →' }
    }

    return { href: '/swipes', label: 'Открыть ULove →' }
  })

  /**
   * Мета-теги витрины ULove.
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
   * @param _next таб лендинга (витрина всегда ULove)
   */
  function setTab(_next: LandingTabId | string): void {
    tab.value = 'ulove'
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
    headerTagClass: computed(() => headerTagClass),
    primaryCta,
    seo,
    isAuthenticated,
    setTab,
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
