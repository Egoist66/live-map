import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAppModulesStore, type AppModule } from '@/stores/appModules'

/**
 * Таб лендинга: разделы с публичной витриной.
 *
 * Публичная витрина только у ULove: остальные модули живут
 * внутри приложения и на лендинг табами не выносятся.
 */
export type LandingTabId = 'ulove'

/**
 * Контент одного таба лендинга.
 */
export interface LandingContent {
  /** плашка-бейдж */
  badge: string
  /** строка рядом с бейджем */
  badgeNote: string
  /** заголовок (3 части) */
  titleTop: string
  /** заголовок (акцентная часть) */
  titleAccent: string
  /** заголовок (хвост) */
  titleTail: string
  /** подзаголовок */
  description: string
  /** подпись вторичной кнопки */
  secondaryLabel: string
  /** строка доверия под статистикой */
  trust: string
  /** цифры */
  stats: Array<{ value: string; note: string }>
  /** шаги «как это работает» */
  steps: Array<{ icon: string; title: string; text: string }>
  /** финальный CTA-блок */
  finalTitle: string
  /** финальный CTA-блок */
  finalText: string
  /** подсказка-переключатель на другой таб */
  crossHint: string
  /** тёмный spotlight-блок */
  spotlight: {
    tag: string
    title: string
    text: string
    tiles: Array<{ top: string; sub: string }>
    chips: string[]
    ctaLabel: string
    ctaHref: string
  }
  /** блок приватности */
  privacy: {
    tag: string
    title: string
    text: string
    chips: string[]
  }
}

/**
 * Палитра таба лендинга (полные классы для Tailwind JIT).
 */
export interface LandingTheme {
  /** акцентный текст заголовка */
  accentText: string
  /** главная кнопка */
  ctaBtn: string
  /** бейдж */
  badge: string
  /** иконки шагов */
  stepIcon: string
  /** логотип */
  logo: string
  /** иконка логотипа */
  logoIcon: string
}

/**
 * SEO таба лендинга.
 */
export interface LandingSeo {
  /** title */
  title: string
  /** description */
  description: string
}

/**
 * FAQ-секция модуля (совпадает с FaqSection из useFaq).
 */
export interface ModuleFaqSection {
  /** id */
  id: string
  /** подпись */
  title: string
  /** иконка-эмодзи */
  icon: string
  /** вопрос */
  q: string
  /** ответ */
  a: string
}

const ULOVE_LANDING: LandingContent = {
  badge: 'ULOVE · LIVE',
  badgeNote: 'живые анкеты рядом · мэтч открывает чат',
  titleTop: 'Люди рядом.',
  titleAccent: 'Мэтч',
  titleTail: '— и вы в чате.',
  description:
    'Листай анкеты рядом, лайкай в один тап и переписывайся только по взаимности. Без ленты и лишнего шума.',
  secondaryLabel: 'Как это работает',
  trust: 'Анонимно по желанию · Блок в 1 клик · 18+',
  stats: [
    { value: 'Мэтч = чат', note: 'только по взаимности' },
    { value: 'Рядом', note: 'фильтр по расстоянию' },
    { value: 'Безлимит', note: 'листай без ограничений' },
  ],
  steps: [
    { icon: 'pi-user-edit', title: '01 · Создай анкету', text: 'Фото, цель и интересы. Займёт пару минут.' },
    { icon: 'pi-heart', title: '02 · Листай рядом', text: 'Смотри анкеты поблизости и ставь лайк в один тап.' },
    { icon: 'pi-comments', title: '03 · Мэтч открывает чат', text: 'Совпали лайки — и вы уже в чате. Без мэтча сообщений нет.' },
  ],
  finalTitle: 'Готов к первому мэтчу?',
  finalText: 'Создай анкету за 2 минуты и начни знакомиться рядом.',
  crossHint: 'Листай ULove →',
  spotlight: {
    tag: '💘 БЕЗ ШУМА И СПАМА',
    title: 'Мэтч открывает чат.',
    text: 'Сообщения приходят только от тех, с кем совпала симпатия. Суперлайк выделит тебя, избранное сохранит понравившихся, а фильтры покажут подходящих.',
    tiles: [
      { top: '⭐ Суперлайк', sub: 'Тебя заметят первым' },
      { top: '💞 Мэтчи', sub: 'Переписка без лимитов' },
      { top: '🎯 Фильтры', sub: 'Цель · возраст · рядом' },
    ],
    chips: ['Только взаимно', 'Без спама', 'Люди рядом'],
    ctaLabel: 'Открыть ULove →',
    ctaHref: '/swipes',
  },
  privacy: {
    tag: '🔒 Приватность по умолчанию',
    title: 'Знакомься спокойно. Без слежки.',
    text: 'Сообщения только по взаимности, блок в один клик. На PRO можно скрыть имя и возраст.',
    chips: ['Только взаимно', 'Блок в 1 клик'],
  },
}

/**
 * Контент табов лендинга.
 */
export const LANDING_CONTENT: Record<LandingTabId, LandingContent> = {
  ulove: ULOVE_LANDING,
}

/**
 * Подписи табов лендинга.
 */
export const LANDING_TAB_OPTIONS: ReadonlyArray<{ label: string; icon: string; value: LandingTabId }> = [
  { label: 'ULove', icon: '💘', value: 'ulove' },
]

/**
 * Палитры табов лендинга.
 */
export const LANDING_THEMES: Record<LandingTabId, LandingTheme> = {
  ulove: {
    accentText: 'bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-500 bg-clip-text text-transparent',
    ctaBtn: '!bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500',
    badge: '!bg-gradient-to-r !from-rose-500 !via-pink-500 !to-fuchsia-500',
    stepIcon: 'bg-gradient-to-r from-rose-500 to-pink-500',
    logo: 'bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-500',
    logoIcon: 'pi pi-heart-fill',
  },
}

/**
 * SEO табов лендинга.
 */
export const LANDING_SEO: Record<LandingTabId, LandingSeo> = {
  ulove: {
    title: 'ULove — люди рядом, мэтч открывает чат',
    description:
      'ULove — знакомства рядом: листай анкеты, лайкай в один тап и переписывайся только по взаимности. Без ленты и лишнего шума. 18+.',
  },
}

/**
 * Подписи в шапке лендинга по табам.
 */
export const LANDING_HEADER_TAGS: Record<LandingTabId, string> = {
  ulove: 'ЗНАКОМСТВА РЯДОМ',
}

/**
 * FAQ-секции, которые появляются при глобальном включении модуля.
 *
 * ULove-секции живут в useFaq всегда; здесь — только дополнения
 * под каждый дополнительный раздел.
 */
export const MODULE_FAQ_EXTRAS: Record<AppModule, ModuleFaqSection[]> = {
  ulove: [],
  upin: [],
  uflow: [
    {
      id: 'uflow-about',
      title: 'Лента UFlow',
      icon: '📰',
      q: 'Что за лента UFlow?',
      a: 'UFlow — лента постов и обсуждений: делись новостями, обсуждай, ставь лайки и подписывайся на интересное.\n\nРаздел управляется в Настройки → Приложение → «Разделы приложения».',
    },
  ],
  districts: [
    {
      id: 'districts-about',
      title: 'Районы',
      icon: '🏘️',
      q: 'Что за раздел «Районы»?',
      a: 'Районы — сообщества по месту: новости района, жители и обсуждения рядом с тобой.\n\nРаздел управляется в Настройки → Приложение → «Разделы приложения».',
    },
  ],
  business: [
    {
      id: 'business-about',
      title: 'Бизнес',
      icon: '💼',
      q: 'Что за раздел «Бизнес»?',
      a: 'Бизнес — кабинет компании: профиль организации и клиенты. Для компаний — регистрация бизнес-аккаунта.',
    },
  ],
}

/**
 * Табы лендинга по глобально включённым модулям.
 *
 * Публичная витрина всегда одна — ULove.
 *
 * @param _globalModules глобально включённые модули
 * @returns доступные табы лендинга
 */
export function landingTabsFor(_globalModules: readonly AppModule[]): LandingTabId[] {
  return ['ulove']
}

/**
 * SEO лендинга по доступным табам.
 *
 * Витрина ULove: её собственное SEO.
 *
 * @param _tabs доступные табы лендинга
 * @returns title и description
 */
export function buildLandingSeo(_tabs: readonly LandingTabId[]): LandingSeo {
  return { ...LANDING_SEO.ulove }
}

/**
 * Бренд шапки по глобальным модулям.
 *
 * Бренд всегда «ULove».
 *
 * @param _globalModules глобально включённые модули
 * @returns голова («U») и хвост («Love») логотипа
 */
export function brandFor(_globalModules: readonly AppModule[]): { head: string; tail: string } {
  return { head: 'U', tail: 'Love' }
}

/**
 * Превью публичных поверхностей для админки «Модули».
 *
 * Показывает, что именно увидят пользователи после включения:
 * табы лендинга и число FAQ-секций. Считается из того же движка,
 * что рисует лендинг, — рассинхрона быть не может.
 *
 * @param globalModules глобально включённые модули
 * @returns подписи табов лендинга и число FAQ-дополнений
 */
export function previewFor(globalModules: readonly AppModule[]): { tabs: string[]; faqExtras: number } {
  const tabs = landingTabsFor(globalModules)

  const tabLabels = tabs.map((tab) => LANDING_TAB_OPTIONS.find((opt) => opt.value === tab)?.label ?? tab)

  const faqExtras = globalModules.reduce((sum, module) => sum + (MODULE_FAQ_EXTRAS[module]?.length ?? 0), 0)

  return { tabs: tabLabels, faqExtras }
}

/**
 * Публичный контент модулей: лендинг, FAQ и бренд из глобального гейта.
 *
 * Один источник правды для всех витрин: админ включает раздел
 * в «Модулях» — табы лендинга, SEO, FAQ и бренд обновляются сами,
 * руками ничего дописывать не нужно. Компоненты только отображают.
 *
 * @returns активные модули, табы лендинга и проверки
 * @example const content = useModuleContent(); content.availableTabs.value
 */
export function useModuleContent() {
  const store = useAppModulesStore()

  try {
    const page = usePage()
    const raw = (page.props as unknown as { globalModules?: unknown }).globalModules

    if (raw !== undefined) {
      store.applyGlobal(raw)
    }
  } catch {
    // No-op: стор держит дефолт ['ulove'].
  }

  const activeModules = computed<AppModule[]>(() => [...store.globalEnabled])

  const availableTabs = computed<LandingTabId[]>(() => landingTabsFor(store.globalEnabled))

  const multiModule = computed(() => store.globalEnabled.length > 1)

  const brand = computed(() => brandFor(store.globalEnabled))

  /**
   * Включён ли модуль публично (глобальный гейт админа).
   *
   * @param module модуль для проверки
   * @returns true если раздел выпущен и виден пользователям
   */
  function isPubliclyOn(module: AppModule): boolean {
    return store.isGloballyEnabled(module)
  }

  /**
   * FAQ-дополнения всех выпущенных модулей одним списком.
   *
   * @returns секции в порядке модулей
   */
  function faqExtras(): ModuleFaqSection[] {
    const extras: ModuleFaqSection[] = []

    for (const module of store.globalEnabled) {
      extras.push(...(MODULE_FAQ_EXTRAS[module] ?? []))
    }

    return extras
  }

  return { activeModules, availableTabs, multiModule, brand, isPubliclyOn, faqExtras }
}
