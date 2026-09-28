import { computed, ref } from 'vue'
import { usePage } from '@inertiajs/vue3'

/**
 * Вкладка стартовой страницы ULove: знакомства или карта-бонус.
 *
 * По ТЗ бизнес-таба больше нет (вместо него — CTA «Сотрудничество»
 * с почтой админа), а механика запоминания выбора убрана: стартовая
 * страница всегда открывается с ULove, переключение таба — чисто
 * локальное состояние без localStorage и без влияния на модули.
 */
export type LandingTab = 'ulove' | 'upin'

const tab = ref<LandingTab>('ulove')

const ULove_CONTENT = {
  badge: 'ULOVE · LIVE',
  badgeNote: 'люди рядом · мэтч открывает чат · карта встреч в бонус',
  titleTop: 'Встречай рядом.',
  titleAccent: 'ULove',
  titleTail: '— главное.',
  description:
    'Свайпы людей рядом, мэтч открывает чат. Без ленты и шума. А карта с пинами — бонус для общения и знакомств: позови на кофе в 2 клика и найди единомышленников рядом, без точного адреса.',
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
  finalText: 'Создай анкету ULove за 2 минуты. А карта уже ждёт как бонус: пины, события и единомышленники рядом.',
  crossHint: 'Интересна карта встреч? Смотри бонус ULove →',
  spotlight: {
    tag: '🗺️ КАРТА-БОНУС · ВСТРЕЧИ БЕЗ АДРЕСА',
    title: 'Карта доводит мэтч до встречи.',
    text: 'Есть мэтч и не знаете где встретиться? Кинь пин «кофе тут» — встретитесь без точного адреса. Вопросы, события и помощь рядом — лёгкий повод написать первым и найти своих.',
    tiles: [
      { top: '☕ Настолки в кофейне', sub: 'Нас трое, нужен четвёртый · до 22:00' },
      { top: '🐕 Кто гуляет с собакой?', sub: 'Парк за домом · выхожу в 19:00' },
      { top: '🚴 Велозаезд в субботу', sub: 'Собираю компанию · старт в 10:00' },
    ],
    chips: ['Пин-свидание в 2 клика', 'Без точного адреса', 'Единомышленники рядом'],
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

const PIN_SAMPLES = [
  { emoji: '☕', title: 'Настолки в кофейне', meta: 'Нас трое, нужен четвёртый · 350 м' },
  { emoji: '🐕', title: 'Кто гуляет с собакой?', meta: 'Парк за домом · выхожу в 19:00 · 800 м' },
  { emoji: '🚴', title: 'Велозаезд в субботу', meta: 'Собираю компанию · старт в 10:00 · 1,2 км' },
]

const PIN_CHIPS = ['Пин в 2 клика', 'Без точного адреса', 'Единомышленники рядом']

/**
 * Переключатель стартовой страницы ULove: знакомства или карта-бонус.
 *
 * Всегда стартует с ULove, выбор таба живёт только в памяти вкладки:
 * никакого localStorage, cookie и влияния на модули приложения.
 *
 * @returns активная вкладка, контент и палитра, CTA под неё
 * @example const landing = useWelcomeMode()
 */
export function useWelcomeMode() {
  const page = usePage()
  const authUser = computed(() => ((page.props as any).auth as any)?.user ?? null)
  const isAuthenticated = computed(() => !!authUser.value)

  const isUlove = computed(() => tab.value === 'ulove')
  const content = computed(() => (isUlove.value ? ULove_CONTENT : UPIN_CONTENT))

  /**
   * Палитра активной стороны: ULove — розово-оранжевая,
   * карта-бонус — тёплая персиково-розовая. Полные строки классов,
   * чтобы Tailwind JIT их увидел.
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
      : {
          accentText: 'bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 bg-clip-text text-transparent',
          ctaBtn: '!bg-gradient-to-r !from-rose-500 !via-pink-500 !to-orange-400',
          badge: '!bg-gradient-to-r !from-rose-500 !via-pink-500 !to-orange-400',
          stepIcon: 'bg-gradient-to-r from-rose-500 to-orange-400',
          logo: 'bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400',
          logoIcon: 'pi pi-map-marker',
        },
  )

  /**
   * Подпись в шапке под активной стороной.
   */
  const headerTag = computed(() =>
    isUlove.value ? 'ULOVE · ЗНАКОМСТВА РЯДОМ' : 'ULOVE-БОНУС · КАРТА ВСТРЕЧ',
  )

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
   * Мета-теги под активную сторону: обе — про ULove.
   */
  const seo = computed(() =>
    isUlove.value
      ? {
          title: 'ULove — знакомства рядом | UPin',
          description:
            'ULove в UPin — знакомства рядом: свайпы, мэтч открывает чат. Карта с пинами — бонус для общения, встреч и единомышленников: позови на кофе в 2 клика без точного адреса.',
        }
      : {
          title: 'UPin — карта встреч | Бонус ULove для знакомств',
          description:
            'Карта UPin — бонус ULove для общения и знакомств: пин-приглашение в 2 клика, события и помощь рядом, единомышленники без точного адреса. Начни со свайпов ULove.',
        },
  )

  /**
   * Переключает таб только в памяти: без localStorage и без
   * влияния на модули приложения — всегда ULove по дефолту.
   *
   * @param next ulove|upin
   */
  function setTab(next: LandingTab): void {
    tab.value = next === 'upin' ? 'upin' : 'ulove'
  }

  return { tab, isUlove, content, theme, headerTag, headerTagClass, primaryCta, seo, isAuthenticated, setTab, pinSamples: PIN_SAMPLES, pinChips: PIN_CHIPS }
}

/**
 * Совместимость: механика запоминания убрана, всегда null.
 *
 * @returns всегда null — выбора больше не запоминаем
 */
export function readLandingTab(): LandingTab | null {
  return null
}
