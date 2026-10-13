import { computed } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAppModulesStore, type AppModule } from '@/stores/appModules'

/**
 * Таб лендинга: разделы с публичной витриной.
 *
 * Витрина есть только у ULove и карты: остальные модули живут
 * внутри приложения и на лендинг табами не выносятся.
 */
export type LandingTabId = 'ulove' | 'upin'

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
  badgeNote: 'люди рядом · мэтч открывает чат',
  titleTop: 'Встречай рядом.',
  titleAccent: 'ULove',
  titleTail: '— главное.',
  description:
    'Свайпы людей рядом, мэтч открывает чат. Без ленты и шума: листай анкеты, ставь лайк в один тап и переписывайся только по взаимности.',
  secondaryLabel: 'Как работает ULove',
  trust: 'Анонимно по желанию · Блок в 1 клик · Строго 18+',
  stats: [
    { value: 'Мэтч → чат', note: 'пишут только взаимно' },
    { value: 'Рядом', note: 'фильтр по расстоянию' },
    { value: 'Безлимит', note: 'свайпы без конца' },
  ],
  steps: [
    { icon: 'pi-user-edit', title: '01 · Создай анкету', text: 'Фото, цель, интересы. Видно только в ULove.' },
    { icon: 'pi-heart', title: '02 · Листай рядом', text: 'Свайпы с фильтром по расстоянию. Лайк — в один тап.' },
    { icon: 'pi-comments', title: '03 · Мэтч открывает чат', text: 'Взаимность — и вы уже переписываетесь. Без мэтча — тихо.' },
  ],
  finalTitle: 'Готов к первому мэтчу?',
  finalText: 'Создай анкету ULove за 2 минуты и листай людей рядом.',
  crossHint: 'Интересна карта встреч? Смотри бонус ULove →',
  spotlight: {
    tag: '💘 ЗНАКОМСТВА БЕЗ ШУМА',
    title: 'Мэтч открывает чат.',
    text: 'Никаких случайных сообщений: пишут только взаимно. Суперлайк выделит тебя, избранное сохранит понравившихся, а фильтры оставят только подходящих.',
    tiles: [
      { top: '⭐ Суперлайк', sub: 'Тебя увидят первым' },
      { top: '💞 Мэтчи', sub: 'Чат без лимитов' },
      { top: '🎯 Фильтры', sub: 'Цель · возраст · рядом' },
    ],
    chips: ['Мэтч → чат', 'Без спама', 'Люди рядом'],
    ctaLabel: 'Открыть ULove →',
    ctaHref: '/swipes',
  },
  privacy: {
    tag: '🔒 Приватность по умолчанию',
    title: 'Спокойно знакомиться. Без слежки.',
    text: 'Сообщения только по взаимности, блок в один клик, невидимость имени и возраста — на PRO.',
    chips: ['Только взаимно', 'Блок в 1 клик'],
  },
}

const UPIN_LANDING: LandingContent = {
  badge: 'ULOVE-БОНУС · КАРТА ВСТРЕЧ',
  badgeNote: 'бонус для общения · знакомств · единомышленников',
  titleTop: 'Познакомились в ULove?',
  titleAccent: 'Карта',
  titleTail: '— где встретиться.',
  description:
    'Карта — ещё один бонус ULove для общения и знакомств: кинь пин «кофе тут» в 2 клика и встретьтесь без точного адреса. Вопросы, события, помощь и компания рядом — лёгкий повод написать первым и найти единомышленников.',
  secondaryLabel: 'Как карта помогает знакомиться',
  trust: 'Бонус ULove · Без точного адреса · Блок в 1 клик',
  stats: [
    { value: 'Мэтч → встреча', note: 'пин вместо адреса' },
    { value: '2 клика', note: 'позвать рядом' },
    { value: 'Часы', note: 'пин живёт, а не висит' },
  ],
  steps: [
    { icon: 'pi-heart', title: '01 · Познакомься в ULove', text: 'Свайпы людей рядом: лайк в один тап, мэтч открывает чат.' },
    { icon: 'pi-map-marker', title: '02 · Кинь пин-приглашение', text: '«Кофе тут», прогулка, настолки — в 2 клика, без точного адреса.' },
    { icon: 'pi-users', title: '03 · Встретьтесь и найди своих', text: 'Комментарии и чат рядом. События и помощь — повод для новых знакомств.' },
  ],
  finalTitle: 'Готов звать на встречу в 2 клика?',
  finalText: 'Создай анкету ULove за 2 минуты — а карта уже ждёт как бонус: пины, события и единомышленники рядом.',
  crossHint: 'Сначала про знакомства? Смотри ULove →',
  spotlight: {
    tag: '💘 КАРТА-КАК-БОНУС · ОБЩЕНИЕ И ВСТРЕЧИ',
    title: 'Карта — повод написать первым.',
    text: 'Не знаешь с чего начать разговор? Пин рядом — готовый повод: «я тоже иду на настолки», «гуляю с собакой в парке», «кто на велозаезд?». Знакомься через общее, а не через «привет».',
    tiles: [
      { top: '☕ «Кофе тут» для мэтча', sub: 'Пин-свидание без адреса · 2 клика' },
      { top: '🎉 События рядом', sub: 'Кинопоказ во дворе · компания сама найдётся' },
      { top: '🤝 Помощь и интересы', sub: 'Донести сумки · велозаезд · настолки' },
    ],
    chips: ['Повод написать первым', 'Единомышленники', 'Без точного адреса'],
    ctaLabel: 'Открыть карту →',
    ctaHref: '/map',
  },
  privacy: {
    tag: '🔒 Адрес — только твой',
    title: 'Соседи видят пин. Не тебя.',
    text: 'Точка пина размыта всегда и для всех — даже для друзей. Точный адрес не показывается никогда, а геолокация хранится размытой.',
    chips: ['Размытие всегда', 'Анонимно по желанию', 'Блок в 1 клик'],
  },
}

/**
 * Контент табов лендинга.
 */
export const LANDING_CONTENT: Record<LandingTabId, LandingContent> = {
  ulove: ULOVE_LANDING,
  upin: UPIN_LANDING,
}

/**
 * Подписи табов лендинга.
 */
export const LANDING_TAB_OPTIONS: ReadonlyArray<{ label: string; icon: string; value: LandingTabId }> = [
  { label: 'ULove', icon: '💘', value: 'ulove' },
  { label: 'UPin · карта', icon: '📍', value: 'upin' },
]

/**
 * Палитры табов лендинга.
 */
export const LANDING_THEMES: Record<LandingTabId, LandingTheme> = {
  ulove: {
    accentText: 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent',
    ctaBtn: '!bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400',
    badge: '!bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400',
    stepIcon: 'bg-gradient-to-r from-rose-500 to-orange-400',
    logo: 'bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400',
    logoIcon: 'pi pi-heart-fill',
  },
  upin: {
    accentText: 'bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 bg-clip-text text-transparent',
    ctaBtn: '!bg-gradient-to-r !from-rose-500 !via-pink-500 !to-orange-400',
    badge: '!bg-gradient-to-r !from-rose-500 !via-pink-500 !to-orange-400',
    stepIcon: 'bg-gradient-to-r from-rose-500 to-orange-400',
    logo: 'bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400',
    logoIcon: 'pi pi-map-marker',
  },
}

/**
 * SEO табов лендинга.
 */
export const LANDING_SEO: Record<LandingTabId, LandingSeo> = {
  ulove: {
    title: 'ULove — знакомства рядом',
    description:
      'ULove — знакомства рядом: свайпы, мэтч открывает чат. Листай людей рядом, лайкай в один тап, переписывайся только по взаимности. Строго 18+.',
  },
  upin: {
    title: 'UPin — карта встреч | Бонус ULove для знакомств',
    description:
      'Карта UPin — бонус ULove для общения и знакомств: пин-приглашение в 2 клика, события и помощь рядом, единомышленники без точного адреса. Начни со свайпов ULove.',
  },
}

/**
 * Подписи в шапке лендинга по табам.
 */
export const LANDING_HEADER_TAGS: Record<LandingTabId, string> = {
  ulove: 'ULOVE · ЗНАКОМСТВА РЯДОМ',
  upin: 'ULOVE-БОНУС · КАРТА ВСТРЕЧ',
}

/**
 * Примеры пинов для витрины карты.
 */
export const PIN_SAMPLES = [
  { emoji: '☕', title: 'Настолки в кофейне', meta: 'Нас трое, нужен четвёртый · 350 м' },
  { emoji: '🐕', title: 'Кто гуляет с собакой?', meta: 'Парк за домом · выхожу в 19:00 · 800 м' },
  { emoji: '🚴', title: 'Велозаезд в субботу', meta: 'Собираю компанию · старт в 10:00 · 1,2 км' },
]

/**
 * Чипы витрины карты.
 */
export const PIN_CHIPS = ['Пин в 2 клика', 'Без точного адреса', 'Единомышленники рядом']

/**
 * FAQ-секции, которые появляются при глобальном включении модуля.
 *
 * ULove-секции живут в useFaq всегда; здесь — только дополнения
 * под каждый дополнительный раздел.
 */
export const MODULE_FAQ_EXTRAS: Record<AppModule, ModuleFaqSection[]> = {
  ulove: [],
  upin: [
    {
      id: 'upin-bonus',
      title: 'Карта как дополнение',
      icon: '📍',
      q: 'Что за карта UPin и как её включить?',
      a: 'UPin — карта как дополнение к знакомствам: люди рядом пишут то, что происходит прямо сейчас — зовут на встречу, просят о помощи, ищут единомышленников.\n\nРаздел управляется в Настройки → Приложение → «Разделы приложения»: там же звезда ★ выбирает стартовый экран (по умолчанию — свайпы).\n\nКак пользоваться: открой карту, выбери фильтр по категории и смотри, что рядом. Новые пины прилетают сами. Клик по карте — создать пин. Включи геолокацию, чтобы карта центрировалась на тебе.',
    },
    {
      id: 'pins',
      title: 'Пины',
      icon: '📌',
      q: 'Что такое пин?',
      a: 'Пин — короткая заметка на карте: заголовок, пара строк текста, точка и фото по желанию.\n\nКатегорий 19: Вопрос, Объявление, Предупреждение, Событие, Отдам, Помощь, Спорт, Еда, Музыка, Животные, Купля-продажа, Работа, Учёба, Путешествия, Технологии, Здоровье, Творчество, Юмор, Отдых. На Pro и выше можно создавать свои категории с иконкой и цветом.\n\nПри создании выбираешь, кто увидит пин: все, только женщины или только мужчины — удобно для «ищу попутчицу» или мужского клуба. Создавать пины можно только в своей стране проживания, смотреть — любую. Сдвинул точку за границу — приложение вежливо предупредит.\n\nЗапрещены политика, контент 18+, наркотики, оружие, ненависть и криминал — такие пины не публикуются.',
    },
    {
      id: 'pin-limits',
      title: 'Лимиты пинов',
      icon: '📦',
      q: 'Сколько пинов можно создать и как долго они живут?',
      a: 'Пины временные, как истории, чтобы карта не зарастала мусором.\n\nЖивых пинов одновременно: Free — 3, Pro/Premium — безлимит, Business (только организации) — безлимит. Как только пин истёк или ты его удалил — место освобождается.\n\nВремя жизни: Free — 4 часа, Pro — 12 часов, Premium и Business — без срока, висит пока не удалишь. Лайфхак: каждые 5 реакций продлевают пин на 1 час (если до конца осталось меньше суток). Буст «Продлить» добавляет сразу +1 день.\n\nРадиус видимости пина выбираешь сам от 500 метров, тариф режет максимум: Free — до 10 км, Pro — до 15 км, Premium и Business — до 50 км. Человек вне зоны твой пин просто не увидит.',
    },
    {
      id: 'pin-privacy',
      title: 'Приватность на карте',
      icon: '👻',
      q: 'Будет ли виден мой точный адрес? Можно ли анонимно?',
      a: 'Сам пин всегда стоит точно там, где ты его поставил — это его смысл. А твоя личная точка (где ты находишься) — размывается: в настройках выбираешь сдвиг точное место / 300 м / 1 км, сдвиг 5 км — только на платных тарифах. По умолчанию стоит 300 м.\n\nПисать можно анонимно: при создании пина скрой имя — соседи увидят «Аноним». Есть переключатель «анонимно по умолчанию». Твой id мы храним (иначе не сработают жалобы и блокировки), но другим людям его не показываем.\n\nНевидимка (тебя нет в онлайне, «был(а) недавно» не обновляется) — на платных тарифах, включается в настройках в один клик.',
    },
    {
      id: 'boosts',
      title: 'Продвижение пина',
      icon: '🚀',
      q: 'Как поднять свой пин?',
      a: 'Если дело срочное — пин на карте можно продвинуть. Типов 4:\n\n• В топ — пин висит первым в выдаче\n• Подсветка — яркая рамка на карте\n• Уведомить — пуш людям рядом\n• Продлить — +1 день к жизни пина\n\nТоп, подсветка и уведомление действуют 1 час. Это разовая оплата, без подписки.',
    },
    {
      id: 'comments',
      title: 'Общение',
      icon: '💬',
      q: 'Как отвечать и общаться?',
      a: 'Под каждым пином — комментарии с ветками ответов и реакции: лайк, огонь, полезно и другие. Свои комментарии можно править, но не чаще 3 правок в сутки на один пин — защита от спама.\n\nДля личного — чат и друзья: заявку можно принять или отклонить, а в настройках приватности выбрать, кто может писать: все, только друзья или никто. Уведомления: домашняя зона (точка + радиус) и подписки на зоны (точки интереса 1–10 км с выбором категорий). Пуши про чат и друзей приходят даже с закрытой вкладкой — разреши уведомления в браузере и в настройках приложения.\n\nУвидел спам или фейк — жми «Пожаловаться»: 3 жалобы скрывают пин из ленты до проверки. Блокировка человека убирает его пины из твоей выдачи и запрещает ему писать тебе.',
    },
  ],
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
 * ULove — всегда; карта — только после глобального включения upin.
 * Порядок фиксированный: сначала знакомства, потом карта.
 *
 * @param globalModules глобально включённые модули
 * @returns доступные табы лендинга
 */
export function landingTabsFor(globalModules: readonly AppModule[]): LandingTabId[] {
  const tabs: LandingTabId[] = ['ulove']

  if (globalModules.includes('upin')) {
    tabs.push('upin')
  }

  return tabs
}

/**
 * SEO лендинга по доступным табам.
 *
 * Один таб — его собственное SEO; оба — объединённое: бренд UPin
 * плюс оба смысла (знакомства + карта).
 *
 * @param tabs доступные табы лендинга
 * @returns title и description
 */
export function buildLandingSeo(tabs: readonly LandingTabId[]): LandingSeo {
  if (tabs.includes('upin')) {
    return {
      title: 'ULove — знакомства рядом | UPin',
      description:
        'ULove в UPin — знакомства рядом: свайпы, мэтч открывает чат. Карта с пинами — бонус для общения, встреч и единомышленников: позови на кофе в 2 клика без точного адреса.',
    }
  }

  return { ...LANDING_SEO.ulove }
}

/**
 * Бренд шапки по глобальным модулям.
 *
 * Один ULove — бренд «ULove»; после выпуска карты возвращается
 * зонтичный «UPin», под которым живут оба раздела.
 *
 * @param globalModules глобально включённые модули
 * @returns голова («U») и хвост («Love»|«Pin») логотипа
 */
export function brandFor(globalModules: readonly AppModule[]): { head: string; tail: string } {
  if (globalModules.length > 1) {
    return { head: 'U', tail: 'Pin' }
  }

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
