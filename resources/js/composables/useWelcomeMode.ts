import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { useAppModulesStore } from '@/stores/appModules'

/**
 * Вкладка лендинга: ULove-знакомства, UPin-карта или UPin Business.
 */
export type LandingTab = 'ulove' | 'upin' | 'business'

const STORAGE_KEY = 'welcome_landing_tab'

const tab = ref<LandingTab>('ulove')
let initialized = false

const ULove_CONTENT = {
  badge: 'ULOVE · LIVE',
  badgeNote: 'люди рядом · мэтч открывает чат · пины на карте',
  titleTop: 'Встречай рядом.',
  titleAccent: 'ULove',
  titleTail: '— главное.',
  description:
    'Свайпы людей рядом, мэтч открывает чат. Без ленты и шума. А карта с пинами — удобная фишка в помощь: позови на кофе в 2 клика, без точного адреса.',
  secondaryLabel: 'Как работает ULove',
  trust: 'Анонимно по желанию · Блок в 1 клик · Пины живут часы',
  stats: [
    { value: 'Мэтч → чат', note: 'пишут только взаимно' },
    { value: 'Рядом', note: 'фильтр по расстоянию' },
    { value: 'Пины · 200 м', note: 'карта без точного адреса' },
  ],
  steps: [
    { icon: 'pi-user-edit', title: '01 · Создай анкету', text: 'Фото, цель, интересы. Видно только в ULove.' },
    { icon: 'pi-heart', title: '02 · Листай рядом', text: 'Свайпы с фильтром по расстоянию. Лайк — в один тап.' },
    { icon: 'pi-comments', title: '03 · Мэтч открывает чат', text: 'Взаимность — и вы уже переписываетесь. Без мэтча — тихо.' },
  ],
  finalTitle: 'Готов к первому мэтчу?',
  finalText: 'Создай анкету ULove за 2 минуты. А карту откроешь, когда захочется встретиться рядом.',
  crossHint: 'Ты больше за карту и соседей? Смотри UPin →',
  spotlight: {
    tag: '🗺️ КАРТА + ПИНЫ · КАЙФ РАЙОНА',
    title: 'Пины — пульс района. Карта удобно дополняет ULove.',
    text: 'Вопросы, события, помощь и объявления рядом — кинь пин в 2 клика и тебя увидят соседи. Есть мэтч и не знаете где встретиться? Кинь пин «кофе тут» — встретитесь без точного адреса. Пины живут часы, а не вечно.',
    tiles: [
      { top: '☕ Настолки в кофейне', sub: 'Нас трое, нужен четвёртый · до 22:00' },
      { top: '🐕 Кто гуляет с собакой?', sub: 'Парк за домом · выхожу в 19:00' },
      { top: '🚴 Велозаезд в субботу', sub: 'Собираю компанию · старт в 10:00' },
    ],
    chips: ['Пин-свидание в 2 клика', 'Без точного адреса', 'Вопросы и помощь рядом'],
    ctaLabel: 'Открыть карту →',
    ctaHref: '/map',
  },
  privacy: {
    tag: '🔒 Приватность по умолчанию',
    title: 'Спокойно знакомиться. Без слежки.',
    text: 'Точное место никогда не показывается. Размытие 200 м, сообщения только взаимно, блок в один клик.',
    chips: ['Размытие 200 м', 'Анонимно по желанию'],
  },
}

const UPIN_CONTENT = {
  badge: 'UPIN · КАРТА РЯДОМ',
  badgeNote: 'пины рядом · события · помощь · без точного адреса',
  titleTop: 'Всё рядом.',
  titleAccent: 'UPin',
  titleTail: '— карта района.',
  description:
    'Вопросы, события, помощь и встречи рядом — кинь пин в 2 клика, и тебя увидят соседи. Точный адрес не показывается никогда: точка всегда размыта. Пины живут часы, а не вечно.',
  secondaryLabel: 'Как работают пины',
  trust: 'Соседи рядом · Анонимно по желанию · Блок в 1 клик',
  stats: [
    { value: '2 клика', note: 'создать пин' },
    { value: 'Без адреса', note: 'точка всегда размыта' },
    { value: 'Часы', note: 'пин живёт, а не висит' },
  ],
  steps: [
    { icon: 'pi-map-marker', title: '01 · Кинь пин в 2 клика', text: 'Вопрос, событие, помощь или встреча — выбери категорию и точку.' },
    { icon: 'pi-users', title: '02 · Соседи рядом увидят', text: 'Пин виден в радиусе. Точный адрес скрыт всегда и для всех.' },
    { icon: 'pi-comments', title: '03 · Встретьтесь и решите', text: 'Комментарии и чат — договоритесь о встрече без лишнего шума.' },
  ],
  finalTitle: 'Готов увидеть свой район?',
  finalText: 'Создай аккаунт за минуту и кинь первый пин. А захочешь знакомиться — рядом всегда ULove.',
  crossHint: 'Хочешь знакомиться? Смотри ULove →',
  spotlight: {
    tag: '📍 КАТЕГОРИИ ПИНОВ · БЕЗ СВАЛКИ',
    title: 'Для каждого повода — свой пин.',
    text: 'Шесть категорий вместо одной свалки объявлений. Фильтруй карту одним тапом и видишь только нужное: хоть помощь с розеткой, хоть компанию на вечер.',
    tiles: [
      { top: '❓ Вопрос', sub: 'Где рядом чинят обувь?' },
      { top: '🎉 Событие', sub: 'Кинопоказ во дворе · пятница' },
      { top: '🤝 Помощь', sub: 'Донести сумки до подъезда' },
      { top: '💘 Встреча', sub: 'Кофе тут — пин для мэтча' },
      { top: '🔧 Услуга', sub: 'Мастер рядом · сегодня' },
      { top: '🔎 Находка', sub: 'Найден кот у парка' },
    ],
    chips: ['Фильтр одним тапом', 'Живут часы', 'Комменты и чат'],
    ctaLabel: 'Открыть карту →',
    ctaHref: '/map',
  },
  privacy: {
    tag: '🔒 Адрес — только твой',
    title: 'Соседи видят пин. Не тебя.',
    text: 'Точка пина размыта всегда и для всех — даже для друзей. Домашняя зона видна только тебе, а геолокация хранится размытой.',
    chips: ['Размытие всегда', 'Зона только тебе', 'Блок в 1 клик'],
  },
}

const PIN_SAMPLES = [
  { emoji: '☕', title: 'Настолки в кофейне', meta: 'Нас трое, нужен четвёртый · 350 м' },
  { emoji: '🐕', title: 'Кто гуляет с собакой?', meta: 'Парк за домом · выхожу в 19:00 · 800 м' },
  { emoji: '🚴', title: 'Велозаезд в субботу', meta: 'Собираю компанию · старт в 10:00 · 1,2 км' },
]

const BUSINESS_CONTENT = {
  badge: 'UPIN PRO · БИЗНЕС',
  badgeNote: 'кабинет компании · проверка по УНП · клиенты с карты',
  titleTop: 'Клиенты рядом.',
  titleAccent: 'UPin Pro',
  titleTail: '— официально.',
  description:
    'Кабинет компании, проверка по УНП и метка на карте, которую видят все. Пины бизнеса больше и заметнее, promo-подпись завлекает. Работаем по законодательству Республики Беларусь.',
  secondaryLabel: 'Как это работает',
  trust: 'Проверка по УНП · Бейдж «Проверено» · Отмена в 1 клик',
  stats: [
    { value: '50 км', note: 'радиус видимости' },
    { value: '×1.45', note: 'пины заметнее' },
    { value: 'УНП', note: 'проверка РБ' },
  ],
  steps: [
    { icon: 'pi-id-card', title: '01 · Регистрация по УНП', text: 'Форма, УНП из 9 цифр и юридический адрес. Реквизиты подставятся в кабинет сами.' },
    { icon: 'pi-verified', title: '02 · Проверка и метка', text: 'После проверки компания появляется на карте у всех — особая метка со списком пинов.' },
    { icon: 'pi-chart-line', title: '03 · Клиенты и продвижение', text: 'Заметные пины, promo-подпись, статистика просмотров. Продвижение — поштучно.' },
  ],
  finalTitle: 'Готовы к клиентам с карты?',
  finalText: 'Регистрация компании за 3 минуты — дальше проверим УНП и включим метку.',
  crossHint: 'Ты персона? Смотри ULove →',
  spotlight: {
    tag: '💼 ВИЗИТКА БИЗНЕСА · $9.99/МЕС',
    title: 'Платите за клиентов, а не за тариф.',
    text: 'Бессрочные пины, радиус 50 км, адрес, телефон, часы и бейдж «Проверено». Плюс поштучно: рекламный пин, пуш по району, купон с кнопкой «Маршрут».',
    tiles: [
      { top: '🏢 Метка компании', sub: 'Видны всем на карте · список пинов' },
      { top: '📢 Promo-подпись', sub: '−20% сегодня · видят все рядом' },
      { top: '👁 Статистика', sub: 'Просмотры, лайки, маршруты' },
    ],
    chips: ['Бессрочные пины', 'Бейдж «Проверено»', 'Пуш по району'],
    ctaLabel: 'Создать кабинет →',
    ctaHref: '/register?account=business',
  },
  privacy: {
    tag: '🇧🇾 Работаем по РБ',
    title: 'Компания под контролем.',
    text: 'Проверка по УНП из 9 цифр и юридическому адресу. Верифицированные получают бейдж доверия и бессрочные пины.',
    chips: ['УНП 9 цифр', 'Юрадрес', 'Проверка'],
  },
}

const PIN_CHIPS = ['Пин в 2 клика', 'Без точного адреса', 'Вопросы и помощь рядом']

/**
 * Переключатель сторон лендинга: ULove или UPin.
 *
 * Стартовая вкладка — из сохранённого выбора гостя или из домашнего
 * режима авторизованного пользователя. Контент hero, шагов и CTA
 * отдаётся готовым объектом, шаблон только отображает.
 *
 * @returns активная вкладка, контент и палитра сторон, CTA под неё
 * @example const landing = useWelcomeMode()
 */
export function useWelcomeMode() {
  const page = usePage()
  const authUser = computed(() => ((page.props as any).auth as any)?.user ?? null)
  const isAuthenticated = computed(() => !!authUser.value)

  if (!initialized) {
    initialized = true
    tab.value = readInitial(authUser.value)
  }

  try {
    useAppModulesStore().ensureInit(authUser.value)
  } catch {
  }

  const isUlove = computed(() => tab.value === 'ulove')
  const isBusiness = computed(() => tab.value === 'business')
  const content = computed(() => (isUlove.value ? ULove_CONTENT : tab.value === 'upin' ? UPIN_CONTENT : BUSINESS_CONTENT))

  /**
   * Палитра активной стороны: ULove — розово-оранжевая, UPin — голубая,
   * Business — индиго-фиолетовая. Полные строки классов, чтобы Tailwind JIT их увидел.
   */
  const theme = computed(() =>
    isUlove.value
      ? {
          accentText: 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400 bg-clip-text text-transparent',
          ctaBtn: '!bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400',
          badge: '!bg-gradient-to-r !from-rose-500 !via-fuchsia-500 !to-orange-400',
          stepIcon: 'bg-gradient-to-r from-rose-500 to-orange-400',
          logo: 'bg-gradient-to-br from-rose-500 via-fuchsia-500 to-orange-400',
          logoIcon: 'pi pi-heart-fill',
        }
      : isBusiness.value
        ? {
            accentText: 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent',
            ctaBtn: '!bg-gradient-to-r !from-indigo-500 !to-violet-600',
            badge: '!bg-gradient-to-r !from-indigo-500 !to-violet-600',
            stepIcon: 'bg-gradient-to-br from-indigo-500 to-violet-600',
            logo: 'bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500',
            logoIcon: 'pi pi-briefcase',
          }
        : {
            accentText: 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 bg-clip-text text-transparent',
            ctaBtn: '!bg-gradient-to-r !from-sky-500 !via-blue-500 !to-indigo-500',
            badge: '!bg-gradient-to-r !from-sky-500 !via-blue-500 !to-indigo-500',
            stepIcon: 'bg-gradient-to-r from-sky-500 to-indigo-500',
            logo: 'bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500',
            logoIcon: 'pi pi-map-marker',
          },
  )

  /**
   * Подпись в шапке под активной стороной.
   */
  const headerTag = computed(() =>
    isUlove.value ? 'ULOVE · ЗНАКОМСТВА РЯДОМ' : isBusiness.value ? 'UPIN PRO · ДЛЯ БИЗНЕСА' : 'UPIN · КАРТА РЯДОМ',
  )

  const headerTagClass = computed(() =>
    isUlove.value
      ? 'bg-gradient-to-r from-rose-500 via-fuchsia-500 to-orange-400'
      : isBusiness.value
        ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500'
        : 'bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500',
  )

  const primaryCta = computed(() => {
    if (isBusiness.value) {
      if (!isAuthenticated.value) {
        return { href: '/register?account=business', label: 'Открыть кабинет →' }
      }
      const accountType = (authUser.value as { account_type?: string } | null)?.account_type
      return accountType === 'business'
        ? { href: '/cabinet', label: 'Открыть кабинет →' }
        : { href: '/map', label: 'Открыть карту →' }
    }
    if (!isAuthenticated.value) {
      return { href: '/register', label: isUlove.value ? 'Создать анкету ULove →' : 'Создать аккаунт UPin →' }
    }
    return isUlove.value ? { href: '/swipes', label: 'Открыть ULove →' } : { href: '/map', label: 'Открыть карту →' }
  })

  /**
   * Мета-теги под активную сторону: тайтл и описание меняются с табом.
   */
  const seo = computed(() =>
    isUlove.value
      ? {
          title: 'ULove — знакомства рядом | UPin',
          description:
            'ULove — знакомства рядом: свайпы, мэтч открывает чат. Карта и пины в помощь: вопросы, события и встречи рядом без точного адреса.',
        }
      : isBusiness.value
        ? {
            title: 'UPin Pro — кабинет для бизнеса | Клиенты с карты',
            description:
              'UPin Pro для бизнеса: кабинет компании, проверка по УНП РБ, метка на карте, заметные пины и клиенты рядом.',
          }
        : {
            title: 'UPin — карта района и соседи рядом | ULove',
            description:
              'UPin — живая карта района: пины соседей, события, помощь и встречи рядом в 2 клика, без точного адреса. Плюс ULove — знакомства рядом.',
          },
  )

  function setTab(next: LandingTab): void {
    tab.value = next
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next)
      }
    } catch {
    }
    try {
      useAppModulesStore().rememberLandingTab(next)
    } catch {
    }
  }

  return { tab, isUlove, isBusiness, content, theme, headerTag, headerTagClass, primaryCta, seo, isAuthenticated, setTab, pinSamples: PIN_SAMPLES, pinChips: PIN_CHIPS }
}

/**
 * Сохранённая вкладка лендинга без фолбэков.
 *
 * @returns ulove|upin из localStorage или null, если не выбирали
 */
export function readLandingTab(): LandingTab | null {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'ulove' || stored === 'upin' || stored === 'business') {
        return stored
      }
    }
  } catch {
  }
  return null
}

/**
 * Начальная вкладка: сохранённый выбор, иначе домашний режим юзера.
 *
 * @param authUser авторизованный пользователь или null
 * @returns ulove|upin
 */
function readInitial(authUser: any): LandingTab {
  const stored = readLandingTab()
  if (stored) {
    return stored
  }
  if (authUser?.account_type === 'business') {
    return 'business'
  }
  const raw = authUser?.default_mode
  if (raw === 'upin' || raw === 'ulove') {
    return raw
  }
  return authUser?.signup_goal === 'neighbors' ? 'upin' : 'ulove'
}
