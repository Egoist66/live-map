import { ref } from 'vue'

/** Идентификатор тарифа. */
export type PlanId = 'free' | 'pro' | 'premium' | 'business'

/** Группа возможностей тарифа для модалки. */
export interface PlanFeatureGroup {
  title: string
  items: string[]
}

/** Полное описание тарифа для модалки. */
export interface PlanDetails {
  id: PlanId
  name: string
  price: string
  tagline: string
  gradient: string
  /** Кому доступен тариф: users — всем, organizations — только кабинету компании. */
  audience: 'users' | 'organizations'
  groups: PlanFeatureGroup[]
}

/**
 * Тарифы приложения: полное описание каждого плана.
 *
 * Источник правды для модалки «Что даёт тариф» в профиле.
 * Данные сверены с FAQ: пины, радиусы, ULove, приватность.
 */
export const PLAN_DETAILS: PlanDetails[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'Бесплатно навсегда',
    tagline: 'Чтобы жить районом и знакомиться рядом',
    gradient: 'from-stone-700 to-stone-900',
    audience: 'users',
    groups: [
      {
        title: '📍 Пины и карта',
        items: [
          '3 живых пина одновременно, жизнь пина — 4 часа',
          'Радиус пинов и домашней зоны — до 10 км',
          'Реакции продлевают жизнь пина (+1 час)',
        ],
      },
      {
        title: '💘 ULove',
        items: [
          'Безлимитные свайпы, рядом — до 10 км',
          'Пишут только мэтчи — бесплатно',
          'Сообщения без мэтча — 3 в месяц',
          'Избранное — до 3 анкет',
          'Базовая статистика: лайки за неделю и месяц, время в приложении',
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          'Размытие точки: точное место, 300 м, 1 км',
          'UDistrict — 2 своих района-заливки',
          'Галерея — 5 фото, скрытых друзей — 1',
          'Анонимные посты в UFlow — до 2',
        ],
      },
    ],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '$4.99 / мес',
    tagline: 'Для активных соседей и знакомств без границ',
    gradient: 'from-violet-600 to-indigo-600',
    audience: 'users',
    groups: [
      {
        title: '📍 Пины и карта',
        items: [
          'Безлимит пинов, жизнь пина — 12 часов',
          'Радиус пинов и домашней зоны — до 15 км',
          'Свои категории пинов с иконкой и цветом',
          'Точная точка дома и размытие до 5 км',
        ],
      },
      {
        title: '💘 ULove',
        items: [
          'Скрытие имени и возраста в анкете',
          'Инкогнито-лайк «Тайный поклонник»',
          'Радиус свайпов — безлимит',
          'Сообщения без мэтча — 10 в месяц',
          'Избранное — до 5 анкет',
          'Кто вас лайкает: интересы, возраст, пол',
          'Уведомления «кто заходил в мой профиль»',
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          'Режим «Невидимка» — тебя не видно в онлайне',
          'Анонимные лайки фото — тебя видят как «Тайного поклонника»',
          'UDistrict — до 5 своих районов',
          'Галерея — 6 фото, скрытых друзей — до 3',
          'Анонимные посты в UFlow — до 5',
          'Смена почты (с подтверждением новой)',
        ],
      },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$9.99 / мес',
    tagline: 'Максимум для активных: всё из PRO без ограничений',
    gradient: 'from-amber-500 to-orange-600',
    audience: 'users',
    groups: [
      {
        title: '📍 Пины и карта',
        items: [
          'Всё из PRO: безлимит пинов и свои категории',
          'Радиус пинов и домашней зоны — до 50 км',
          'Пины без срока жизни — висят, пока не удалишь',
        ],
      },
      {
        title: '💘 ULove',
        items: [
          'Всё из PRO: инкогнито, скрытие имени и возраста',
          'Безлимитный сброс просмотренных свайпов',
          'Избранное — до 15 анкет',
          'Гости профиля: кто заходил, анкета целиком, кнопка «Написать»',
          'Уведомления о гостях — как в PRO, плюс выгрузка статистики в CSV',
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          'Режим «Невидимка» и размытие до 5 км',
          'UDistrict — до 15 своих районов',
          'Галерея — 15 фото, скрытые друзья — без лимита',
          'Смена почты — как в PRO',
        ],
      },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$19.99 / мес',
    tagline: 'Только для организаторов: кабинет компании + всё из Premium',
    gradient: 'from-stone-900 to-amber-700',
    audience: 'organizations',
    groups: [
      {
        title: '📍 Пины и карта',
        items: [
          'Всё из Premium: безлимит пинов, 50 км, пины без срока',
          'Кабинет компании: витрина на карте',
        ],
      },
      {
        title: '💘 ULove',
        items: [
          'Всё из Premium: инкогнито, скрытие имени и возраста',
          'Избранное — до 15 анкет',
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          'Режим «Невидимка» и размытие до 5 км',
          'UDistrict — до 15 своих районов',
          'Галерея — 15 фото, скрытые друзья — без лимита',
          'Бизнес-профиль: название, адрес, телефон, сайт, часы работы',
        ],
      },
    ],
  },
]

/**
 * Тарифы для обычных пользователей: только Free / Pro / Premium.
 *
 * Business здесь нет — он живёт отдельно в кабинете компании
 * (см. ORGANIZATION_PLAN_DETAILS) и недоступен персонам.
 */
export const USER_PLAN_DETAILS: PlanDetails[] = PLAN_DETAILS.filter((p) => p.audience === 'users')

/**
 * Тариф кабинета компании: только Business.
 */
export const ORGANIZATION_PLAN_DETAILS: PlanDetails[] = PLAN_DETAILS.filter((p) => p.audience === 'organizations')

/**
 * Модалка «Что даёт тариф»: какой план показать.
 *
 * @returns выбранный план и действия модалки
 * @example const plans = usePlanDetails(); plans.showPlan('pro')
 */
export function usePlanDetails() {
  const dialogPlan = ref<PlanDetails | null>(null)

  /**
   * Открыть модалку с описанием тарифа.
   * @param id идентификатор тарифа
   */
  function showPlan(id: PlanId): void {
    dialogPlan.value = PLAN_DETAILS.find((p) => p.id === id) ?? null
  }

  /** Закрыть модалку. */
  function hide(): void {
    dialogPlan.value = null
  }

  return { dialogPlan, showPlan, hide, plans: PLAN_DETAILS, userPlans: USER_PLAN_DETAILS }
}
