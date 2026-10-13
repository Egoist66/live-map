import { ref } from 'vue'
import { usePlansCatalog } from '@/composables/usePlansCatalog'
import { useAppModulesStore, type AppModule } from '@/stores/appModules'

/** Идентификатор тарифа. */
export type PlanId = 'free' | 'pro' | 'premium' | 'business'

/** Строка возможности тарифа с привязкой к модулям. */
export interface PlanFeatureItem {
  /** текст строки */
  text: string
  /**
   * Показать только когда включён хотя бы один из модулей.
   * Без поля — строка базовая (ULove/профиль) и видна всегда:
   * ULove выключить нельзя, а карта/лента/районы — можно.
   */
  modules?: AppModule[]
}

/** Группа возможностей тарифа для модалки. */
export interface PlanFeatureGroup {
  title: string
  items: PlanFeatureItem[]
  /** Скрыть группу целиком, пока ни один из модулей не включён. */
  modules?: AppModule[]
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

/** Короткая запись строки без привязки к модулям. */
function t(text: string): PlanFeatureItem {
  return { text }
}

/**
 * Строка, видимая только при включённых модулях
 * (карта, лента, районы, бизнес — пока выключены, их нет в тарифах).
 */
function tm(text: string, modules: AppModule[]): PlanFeatureItem {
  return { text, modules }
}

const UPIN: AppModule[] = ['upin']
const UFLOW: AppModule[] = ['uflow']
const DISTRICTS: AppModule[] = ['districts']
const BUSINESS: AppModule[] = ['business']

/**
 * Тарифы приложения: запасное описание каждого плана (офлайн-страховка).
 *
 * Основной источник правды — бэкенд: каталог отдаёт названия, цены и списки
 * «что входит», которые ведутся в админке (раздел тарифов). Этот файл нужен
 * лишь пока бэкенд недоступен или список в админке ещё пуст: как только
 * в админке появляются возможности тарифа, модалка показывает их первыми,
 * а запасные строки, уже покрытые живыми, скрываются (без дублей).
 * Стартовый набор админки — зеркало этих строк 1:1 (см. PaymentItemSeeder).
 */
export const PLAN_DETAILS: PlanDetails[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'Бесплатно навсегда',
    tagline: 'Знакомься рядом — бесплатно навсегда',
    gradient: 'from-stone-700 to-stone-900',
    audience: 'users',
    groups: [
      {
        title: '💘 ULove',
        items: [
          t('Безлимитные свайпы рядом'),
          t('Пишут только мэтчи — бесплатно'),
          t('Сообщения без мэтча — 3 в месяц'),
          t('Избранное — до 3 анкет'),
          t('Кто тебя лайкнул: счётчик и базовая статистика'),
        ],
      },
      {
        title: '📍 Пины и карта',
        modules: UPIN,
        items: [
          t('3 живых пина одновременно, жизнь пина — 4 часа'),
          t('Радиус пинов и домашней зоны — до 10 км'),
          t('Реакции продлевают жизнь пина (+1 час)'),
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          t('Галерея — 5 фото, скрытых друзей — 1'),
          tm('Размытие точки: точное место, 300 м, 1 км', UPIN),
          tm('UDistrict — 2 своих района-заливки', DISTRICTS),
          tm('Анонимные посты в UFlow — до 2', UFLOW),
        ],
      },
      {
        title: '💬 Чаты',
        items: [
          t('Закрепы чатов — без лимита, важные всегда сверху как в Telegram'),
          t('Выгрузка любой переписки в аккуратный HTML'),
        ],
      },
    ],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: '$3.99 / мес',
    tagline: 'Для активных знакомств: тебя видят, тебе отвечают',
    gradient: 'from-violet-600 to-indigo-600',
    audience: 'users',
    groups: [
      {
        title: '💘 ULove',
        items: [
          t('Скрытие имени и возраста в анкете'),
          t('Инкогнито-лайк «Тайный поклонник»'),
          t('Радиус свайпов — безлимит'),
          t('Сообщения без мэтча — 20 в месяц'),
          t('Избранное — до 10 анкет'),
          t('Кто вас лайкает: интересы, возраст, пол'),
          t('Уведомления «кто заходил в мой профиль»'),
          t('Суперлайки — 5 в день, возвраты свайпов — безлимит'),
        ],
      },
      {
        title: '📍 Пины и карта',
        modules: UPIN,
        items: [
          t('Безлимит пинов, жизнь пина — 12 часов'),
          t('Радиус пинов и домашней зоны — до 15 км'),
          t('Свои категории пинов с иконкой и цветом'),
          t('Точная точка дома и размытие до 5 км'),
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          t('Режим «Невидимка» — тебя не видно в онлайне'),
          t('Анонимные лайки фото — тебя видят как «Тайного поклонника»'),
          t('Галерея — 10 фото, скрытых друзей — до 3'),
          tm('UDistrict — до 5 своих районов', DISTRICTS),
          tm('Анонимные посты в UFlow — до 5', UFLOW),
        ],
      },
      {
        title: '💬 Чаты',
        items: [
          t('Выгрузка любой переписки в аккуратный HTML'),
        ],
      },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$7.99 / мес',
    tagline: 'Максимум для знакомств: всё из PRO без ограничений',
    gradient: 'from-amber-500 to-orange-600',
    audience: 'users',
    groups: [
      {
        title: '💘 ULove',
        items: [
          t('Всё из PRO: инкогнито, скрытие имени и возраста'),
          t('Безлимитный сброс просмотренных свайпов'),
          t('Избранное — до 15 анкет'),
          t('Гости профиля: кто заходил, анкета целиком, кнопка «Написать»'),
          t('Уведомления о гостях плюс выгрузка статистики в CSV'),
        ],
      },
      {
        title: '📍 Пины и карта',
        modules: UPIN,
        items: [
          t('Безлимит пинов без срока жизни'),
          t('Радиус пинов и домашней зоны — до 50 км'),
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          t('Режим «Невидимка» — тебя не видно в онлайне'),
          t('Галерея — 15 фото, скрытые друзья — без лимита'),
          tm('Размытие точки до 5 км', UPIN),
          tm('UDistrict — до 15 своих районов', DISTRICTS),
        ],
      },
      {
        title: '💬 Чаты',
        items: [
          t('Выгрузка любой переписки в аккуратный HTML'),
        ],
      },
    ],
  },
  {
    id: 'business',
    name: 'Business',
    price: '$19.99 / мес',
    tagline: 'Только для организаций: кабинет компании',
    gradient: 'from-stone-900 to-amber-700',
    audience: 'organizations',
    groups: [
      {
        title: '🏢 Кабинет',
        modules: BUSINESS,
        items: [
          t('Бизнес-профиль: название, адрес, телефон, сайт, часы работы'),
          t('Бейдж организации и витрина в поиске'),
        ],
      },
      {
        title: '📍 Пины и карта',
        modules: UPIN,
        items: [
          t('Безлимит пинов без срока жизни, радиус — до 50 км'),
        ],
      },
      {
        title: '🔒 Приватность и профиль',
        items: [
          t('Режим «Невидимка» — тебя не видно в онлайне'),
          t('Галерея — 15 фото, скрытые друзья — без лимита'),
          tm('Размытие точки до 5 км', UPIN),
          tm('UDistrict — до 15 своих районов', DISTRICTS),
        ],
      },
      {
        title: '💬 Чаты',
        items: [
          t('Выгрузка любой переписки в аккуратный HTML'),
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
 * Видна ли сущность (группа/строка) при включённых модулях.
 *
 * @param modules привязка сущности, без поля — видна всегда
 * @param isEnabled проверка модуля из стора
 */
function isVisible(
  modules: AppModule[] | undefined,
  isEnabled: (module: AppModule) => boolean,
): boolean {
  if (!modules || modules.length === 0) return true

  return modules.some((module) => isEnabled(module))
}

/**
 * Модалка «Что даёт тариф»: какой план показать.
 *
 * Группы и строки про выключенные модули (карта, лента, районы,
 * бизнес) скрываются: пока модуль не включён админом, в тарифах
 * о нём ни слова. Цена подтягивается из каталога бэка.
 *
 * @returns выбранный план и действия модалки
 * @example const plans = usePlanDetails(); plans.showPlan('pro')
 */
export function usePlanDetails() {
  const dialogPlan = ref<PlanDetails | null>(null)
  const { catalog, priceFor, featuresFor } = usePlansCatalog()
  const modules = useAppModulesStore()

  /**
   * Открыть модалку с описанием тарифа.
   *
   * Названия, цены и списки «что входит» подтягиваются с бэкенда
   * (админка поверх настроек по умолчанию). Запасные строки из этого
   * файла показываются, только если в админке для тарифа пока пусто;
   * покрытые живыми строками запасные — скрываются, чтобы не двоить.
   * @param id идентификатор тарифа
   */
  function showPlan(id: PlanId): void {
    const found = PLAN_DETAILS.find((p) => p.id === id) ?? null

    if (!found) {
      dialogPlan.value = null
      return
    }

    const liveFeatures = featuresFor(found.id)
    const liveGroup: PlanFeatureGroup | null =
      liveFeatures.length > 0
        ? {
            title: '✨ Что входит',
            items: liveFeatures.map((f) => t(f.description ? `${f.name} — ${f.description}` : f.name)),
          }
        : null

    const liveNames = new Set(liveFeatures.map((f) => f.name.trim().toLowerCase()))

    const fallbackGroups = found.groups
      .filter((group) => isVisible(group.modules, (m) => modules.isEnabled(m)))
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) => isVisible(item.modules, (m) => modules.isEnabled(m)) && !liveNames.has(item.text.trim().toLowerCase()),
        ),
      }))
      .filter((group) => group.items.length > 0)

    const groups = liveGroup !== null ? [liveGroup, ...fallbackGroups] : fallbackGroups
    const livePlan = catalog.value?.plans.find((p) => p.id === found.id)

    dialogPlan.value = {
      ...found,
      name: livePlan?.name || found.name,
      tagline: livePlan?.tagline || found.tagline,
      groups,
      price: priceFor(found.id) || found.price,
    }
  }

  /** Закрыть модалку. */
  function hide(): void {
    dialogPlan.value = null
  }

  return { dialogPlan, showPlan, hide, plans: PLAN_DETAILS, userPlans: USER_PLAN_DETAILS }
}
