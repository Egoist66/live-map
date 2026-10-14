import { computed, reactive, watch, type ComputedRef, type Ref } from 'vue'
import { useMediaQuery, useStorage } from '@vueuse/core'
import { useAdminTabs, type AdminTabId } from '@/composables/useAdminTabs'
import { useStaffRole } from '@/composables/useStaffRole'

/**
 * Пункт бокового меню админки в духе WordPress.
 */
export interface AdminNavItem {
  /** ID таба, который открывает пункт. */
  id: AdminTabId
  /** Короткая подпись в меню. */
  label: string
  /** Подсказка под подписью (видна в развёрнутом меню). */
  hint: string
  /** Класс иконки primeicons (например `pi pi-users`). */
  icon: string
  /** Группа-сепаратор в духе WP (`Контент`, `Настройки`…). */
  group: string
  /** Текст бейджа-счётчика (жалобы, бизнес, алерты). */
  badge?: string
  /** Цвет бейджа по семантике PrimeVue. */
  badgeSeverity?: 'danger' | 'warn' | 'info'
  /** Пункт только для полных админов (модератор его не видит). */
  adminOnly: boolean
}

/**
 * Группа пунктов меню для отрисовки сепараторов.
 */
export interface AdminNavGroup {
  /** Заголовок группы. */
  title: string
  /** Пункты группы, уже отфильтрованные по роли. */
  items: AdminNavItem[]
}

/**
 * Входящие счётчики для бейджей меню.
 */
export interface AdminLayoutBadges {
  /** Жалобы в ожидании (таб «Модерация»). */
  reports: number
  /** Заявки бизнеса в ожидании (таб «Бизнес»). */
  business: number
  /** Новые обращения в поддержку (таб «Обращения»). */
  support: number
  /** Непросмотренные алерты безопасности (таб «Безопасность»). */
  security: number
}

/**
 * Состояние WP-раскладки: свёрнутость сайдбара и мобильный drawer.
 */
export interface AdminLayoutState {
  /** Десктоп: узкий сайдбар-иконки (как «Свернуть меню» в WP). */
  collapsed: boolean
  /** Мобила: открыт ли Drawer с меню. */
  drawerOpen: boolean
}

const COLLAPSE_KEY = 'ulove-admin-menu-collapsed'

/**
 * Форматировать счётчик в бейдж: 0 прячем, >99 режем до «99+».
 *
 * @param value Сырой счётчик.
 * @returns Текст бейджа или undefined, если показывать нечего.
 */
function formatBadge(value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }

  if (value > 99) {
    return '99+'
  }

  return String(value)
}

/**
 * WP-раскладка админки: сайдбар-меню, верхняя панель, мобильный drawer.
 *
 * Вся навигационная логика живёт здесь (Правило №1): компонент
 * `Pages/Admin/Index.vue` только рисует, а `AdminSidebar`/`AdminTopbar` —
 * чистое отображение пропсов этого хука.
 *
 * Поведение в духе WordPress:
 * - десктоп: тёмный сайдбар слева (260px, в свёрнутом виде 76px),
 *   сворачивание запоминается в localStorage;
 * - мобила (<lg): сайдбар прячется, меню открывается через Drawer-бургер;
  * - выбор пункта переключает раздел (`/admin/business`…) через `useAdminTabs` и сам закрывает drawer.
 *
 * @param badges Реактивные счётчики для бейджей меню.
 * @returns Состояние, группы меню, активный пункт, заголовок и экшены.
 * @example
 * const badges = computed(() => ({ reports: 3, business: 0, support: 1, security: 1 }))
 * const layout = useAdminLayout(badges)
 * // layout.navGroups.value → [{ title: 'Контент', items: [...] }]
 * // layout.selectTab('admin')
 */
export function useAdminLayout(badges: Ref<AdminLayoutBadges> | ComputedRef<AdminLayoutBadges>) {
  const { tab, setTab } = useAdminTabs()
  const staff = useStaffRole()

  const collapsedStorage = useStorage(COLLAPSE_KEY, false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const state = reactive<AdminLayoutState>({
    collapsed: collapsedStorage.value,
    drawerOpen: false,
  })

  watch(
    () => state.collapsed,
    (next) => {
      collapsedStorage.value = next
    },
  )

  watch(isDesktop, (desktop) => {
    if (desktop) {
      state.drawerOpen = false
    }
  })

  /**
   * Полный каталог пунктов меню с бейджами из входящих счётчиков.
   */
  const allItems = computed<AdminNavItem[]>(() => {
    const counts = badges.value
    const reportsBadge = formatBadge(counts.reports)
    const businessBadge = formatBadge(counts.business)
    const supportBadge = formatBadge(counts.support)
    const securityBadge = formatBadge(counts.security)

    return [
      {
        id: 'stats',
        label: 'Консоль',
        hint: 'Онлайн, рост и активность',
        icon: 'pi pi-th-large',
        group: '',
        adminOnly: false,
      },
      {
        id: 'manage',
        label: 'Пользователи',
        hint: 'роли, тарифы, баны',
        icon: 'pi pi-users',
        group: 'Пользователи',
        adminOnly: true,
      },
      {
        id: 'telegram',
        label: 'Telegram',
        hint: 'привязки и рассылки',
        icon: 'pi pi-send',
        group: 'Пользователи',
        adminOnly: false,
      },
      {
        id: 'admin',
        label: 'Модерация',
        hint: 'жалобы и контент',
        icon: 'pi pi-flag',
        group: 'Контент',
        badge: reportsBadge,
        badgeSeverity: 'danger',
        adminOnly: false,
      },
      {
        id: 'business',
        label: 'Бизнес',
        hint: 'заявки компаний',
        icon: 'pi pi-briefcase',
        group: 'Контент',
        badge: businessBadge,
        badgeSeverity: 'warn',
        adminOnly: false,
      },
      {
        id: 'support',
        label: 'Обращения',
        hint: 'вопросы пользователей',
        icon: 'pi pi-inbox',
        group: 'Контент',
        badge: supportBadge,
        badgeSeverity: 'danger',
        adminOnly: false,
      },
      {
        id: 'refs',
        label: 'Справочники',
        hint: 'категории и словари',
        icon: 'pi pi-book',
        group: 'Контент',
        adminOnly: false,
      },
      {
        id: 'security',
        label: 'Безопасность',
        hint: 'входы и имперсонация',
        icon: 'pi pi-shield',
        group: 'Безопасность',
        badge: securityBadge,
        badgeSeverity: 'danger',
        adminOnly: true,
      },
      {
        id: 'modules',
        label: 'Модули',
        hint: 'фичи и новости релизов',
        icon: 'pi pi-box',
        group: 'Настройки',
        adminOnly: true,
      },
      {
        id: 'payments',
        label: 'Тарифы',
        hint: 'цены, что входит, оплаты',
        icon: 'pi pi-credit-card',
        group: 'Настройки',
        adminOnly: true,
      },
      {
        id: 'ai',
        label: 'ИИ',
        hint: 'ассистент и лимиты',
        icon: 'pi pi-sparkles',
        group: 'Настройки',
        adminOnly: true,
      },
      {
        id: 'seo',
        label: 'SEO',
        hint: 'мета, sitemap, скрипты',
        icon: 'pi pi-globe',
        group: 'Настройки',
        adminOnly: false,
      },
    ]
  })

  /**
   * Пункты, доступные текущей роли, сгруппированные сепараторами.
   */
  const navGroups = computed<AdminNavGroup[]>(() => {
    const visibleItems = allItems.value.filter((item) => staff.canViewTab(item.id))
    const order: string[] = []
    const byGroup = new Map<string, AdminNavItem[]>()

    for (const item of visibleItems) {
      const bucket = byGroup.get(item.group)

      if (bucket) {
        bucket.push(item)
      } else {
        byGroup.set(item.group, [item])
        order.push(item.group)
      }
    }

    return order.map((title) => ({
      title,
      items: byGroup.get(title) ?? [],
    }))
  })

  /**
   * Активный пункт меню для подсветки (стрелка WP).
   */
  const activeItem = computed<AdminNavItem | undefined>(() => {
    return allItems.value.find((item) => item.id === tab.value)
  })

  /**
   * Заголовок контент-области в духе `h1.wp-heading-inline`.
   */
  const pageHeading = computed(() => {
    const current = activeItem.value

    if (!current) {
      return { title: 'Консоль', hint: 'Онлайн, рост и активность' }
    }

    return { title: current.label, hint: current.hint }
  })

  /**
   * Свернуть/развернуть сайдбар (десктоп, «Свернуть меню» из WP).
   */
  function toggleCollapse(): void {
    state.collapsed = !state.collapsed
  }

  /**
   * Открыть мобильный Drawer с меню (бургер в админ-баре).
   */
  function openDrawer(): void {
    state.drawerOpen = true
  }

  /**
   * Закрыть мобильный Drawer с меню.
   */
  function closeDrawer(): void {
    state.drawerOpen = false
  }

  /**
   * Выбрать раздел: переключить `?tab=` и закрыть drawer на мобиле.
   *
   * @param next ID таба из меню.
   */
  function selectTab(next: AdminTabId): void {
    if (!staff.canViewTab(next)) {
      return
    }

    setTab(next)
    state.drawerOpen = false
  }

  return {
    state,
    isDesktop,
    navGroups,
    activeItem,
    pageHeading,
    toggleCollapse,
    openDrawer,
    closeDrawer,
    selectTab,
  }
}
