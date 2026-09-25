import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router, usePage } from '@inertiajs/vue3'
import { useBadgeStore } from '@/stores/badges'
import { useAppModulesStore } from '@/stores/appModules'
import { route } from '@/route'

/**
 * Состояние нижней мобильной навигации.
 *
 * Прячет меню при открытой клавиатуре, чтобы инпуты чата/комментариев
 * не уезжали под навигацию в WebView и мобильном браузере.
 *
 * @returns ссылки, активность, бейджи и флаг скрытия клавиатурой
 * @example
 * const { dashboardHref, isActive, total, navHidden } = useMobileBottomNav()
 */
export function useMobileBottomNav() {
  const badge = useBadgeStore()
  const page = usePage()
  const keyboardOpen = ref(false)

  /**
   * Бизнес-аккаунт: нижнее меню без персональных разделов
   * (профиль персоны, ULove, UFlow) — только кабинет, карта и чат.
   */
  const isBusiness = computed(() => {
    try {
      return (page.props as unknown as { auth?: { user?: { account_type?: string } | null } }).auth?.user?.account_type === 'business'
    } catch {
      return false
    }
  })

  /**
   * Стафф (админ/модератор): мобильное меню без лишнего.
   *
   * Районы — пользовательский раздел сообществ, стаффу он не нужен
   * в нижней навигации (есть веб-доступ по прямой ссылке и админка).
   * Прячем только на мобиле, чтобы уложиться в 5 пунктов.
   */
  const isStaff = computed(() => {
    const authUser = (page.props as unknown as { auth?: { user?: { is_admin?: boolean; role?: string } | null } }).auth?.user

    if (!authUser) {
      return false
    }

    const isAdminFlag = Boolean(authUser.is_admin)
    const isAdminRole = authUser.role === 'admin'
    const isModeratorRole = authUser.role === 'moderator'

    return isAdminFlag || isAdminRole || isModeratorRole
  })

  const dashboardHref = computed(() => route('dashboard'))
  const total = computed(() => badge.unread)

  /**
   * Видимость пунктов по включённым модулям.
   *
   * Изоляция: ULove-пользователь не видит карту и ленту,
   * UPin-пользователь — свайпы. Лишнее довключается в настройках.
   * Профиль и чат — всегда (общее ядро).
   */
  const modules = useAppModulesStore()

  const showMap = computed(() => isBusiness.value || modules.isEnabled('upin'))
  const showLove = computed(() => !isBusiness.value && modules.isEnabled('ulove'))
  const showFlow = computed(() => !isBusiness.value && modules.isEnabled('uflow'))
  const showDistricts = computed(() => {
    if (isBusiness.value) {
      return false
    }

    if (isStaff.value) {
      return false
    }

    return modules.isEnabled('districts')
  })

  /**
   * Класс сетки под число видимых пунктов.
   *
   * Полные имена классов — Tailwind JIT видит их статически.
   */
  const gridClass = computed(() => {
    if (isBusiness.value) {
      return 'grid grid-cols-3 items-end px-1 pt-1.5 pb-2 min-h-[60px]'
    }

    let count = 2

    if (showMap.value) {
      count += 1
    }

    if (showLove.value) {
      count += 1
    }

    if (showFlow.value) {
      count += 1
    }

    if (showDistricts.value) {
      count += 1
    }

    if (count <= 3) {
      return 'grid grid-cols-3 items-end px-1 pt-1.5 pb-2 min-h-[60px]'
    }

    if (count === 4) {
      return 'grid grid-cols-4 items-end px-1 pt-1.5 pb-2 min-h-[60px]'
    }

    if (count >= 6) {
      return 'grid grid-cols-6 items-end px-1 pt-1.5 pb-2 min-h-[60px]'
    }

    return 'grid grid-cols-5 items-end px-1 pt-1.5 pb-2 min-h-[60px]'
  })

  /**
   * Реактивный путь текущей страницы.
   *
   * Ziggy `route().current()` читает `window.location` напрямую и не
   * реактивен: после клиентского перехода Inertia панель не
   * пересчитывалась и подсветка застревала на старом пункте.
   * Поэтому путь тянем в ref и обновляем по событию навигации —
   * шаблон пересчитывает классы сам, без ре-рендера сверху.
   */
  const currentPath = ref('')

  /**
   * Синхронизирует путь с адресной строкой.
   *
   * @returns void
   */
  function syncPath(): void {
    try {
      currentPath.value = window.location.pathname
    } catch {
      currentPath.value = ''
    }
    syncHtmlClass()
  }

  /**
   * Базовый путь пункта меню (без query и хоста).
   *
   * @param name имя роута
   * @returns путь вроде `/map` или пусто при ошибке
   */
  function basePathOf(name: string): string {
    try {
      const href: unknown = route(name, {}, false)
      if (typeof href !== 'string') return ''
      const cut = href.split('?')[0].split('#')[0]
      return cut === '' ? '/' : cut
    } catch {
      return ''
    }
  }

  /**
   * Проверяет активность пункта меню по префиксу пути.
   *
   * Префикс (а не точное равенство) нужен для вложенных экранов:
   * `/swipes/favorites`, `/chat/5`, `/flow/post/1` подсвечивают
   * свой раздел. Чтение `currentPath` делает проверку реактивной.
   *
   * @param name имя роута
   * @returns true если текущий путь — сам раздел или его подраздел
   */
  function isActive(name: string): boolean {
    const path = currentPath.value
    if (!path) return false
    const base = basePathOf(name)
    if (!base) return false
    if (path === base) return true
    const withSlash = base.endsWith('/') ? base : `${base}/`
    return path.startsWith(withSlash)
  }

  /**
   * Классы пункта навигации.
   *
   * Активный — тиндеровский rose (#FD267D, в тёмной теме rose-400
   * #FB7185 для контраста на #0F121F) плюс тонированная пилюля
   * rose-500/10 (светлая) / rose-500/15 (тёмная). Неактивный —
   * приглушённый серый, хорошо отличимый от активного в обеих темах.
   *
   * @param name имя роута
   * @returns строка классов для Link пункта меню
   * @example
   * :class="navLinkClass('map')"
   */
  function navLinkClass(name: string): string {
    if (isActive(name)) {
      return 'text-[#FD267D] dark:text-rose-400 bg-rose-500/10 dark:bg-rose-500/15'
    }
    return 'text-stone-500 dark:text-zinc-400'
  }

  /**
   * На свайпах ULove нижнее меню скрыто, как в Tinder:
   * профиль, сообщения и разделы — в верхнем баре и шторке.
   */
  const onSwipes = computed(() => {
    const path = currentPath.value

    if (!path) {
      return false
    }

    return path === '/swipes' || path.startsWith('/swipes/')
  })

  const navHidden = computed(() => keyboardOpen.value || onSwipes.value)

  /**
   * Активность по пути без Ziggy-имён (для разделов вроде `/cabinet`,
   * которых может не быть в конфиге): точное совпадение или префикс.
   *
   * @param path путь раздела вроде `/cabinet`
   * @returns true если текущий путь — сам раздел или его подраздел
   * @example :class="isActivePath('/cabinet') ? active : idle"
   */
  function isActivePath(path: string): boolean {
    const current = currentPath.value
    if (!current || !path) return false
    if (current === path) return true
    const withSlash = path.endsWith('/') ? path : `${path}/`
    return current.startsWith(withSlash)
  }

  /**
   * Десктоп с физической клавиатурой: visualViewport не сжимается,
   * фокус в инпуте не означает экранную клавиатуру. Иначе фокус
   * в поле чата на десктопе добавлял бы `native-keyboard-open`
   * и дёргал высоту `.h-app-full` вниз/вверх.
   *
   * @returns true на ширине десктопа (lg и шире)
   */
  function isDesktopViewport(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia('(min-width: 1024px)').matches
  }

  /**
   * Пересчитывает признак открытой клавиатуры по visualViewport.
   *
   * @returns void
   */
  function recalcKeyboard(): void {
    if (isDesktopViewport()) {
      keyboardOpen.value = false
      return
    }
    const viewport = window.visualViewport
    if (!viewport) {
      keyboardOpen.value = false
      return
    }
    const diff = window.innerHeight - viewport.height - viewport.offsetTop
    keyboardOpen.value = diff > 80
  }

  /**
   * Синхронизирует классы на <html> для CSS-скрытия меню.
   *
   * Клавиатура и свайпы ULove (там свой топбар, как в Tinder)
   * прячут нижнее меню через CSS-трансформ без скачков вёрстки.
   *
   * @returns void
   */
  function syncHtmlClass(): void {
    const root = document.documentElement
    if (keyboardOpen.value) {
      root.classList.add('native-keyboard-open')
    } else {
      root.classList.remove('native-keyboard-open')
    }
    if (onSwipes.value) {
      root.classList.add('native-swipes')
    } else {
      root.classList.remove('native-swipes')
    }
  }

  /**
   * Обработчик фокуса: клавиатура почти наверняка открыта в поле ввода.
   *
   * @param event событие фокуса
   * @returns void
   */
  function onFocusIn(event: FocusEvent): void {
    if (isDesktopViewport()) {
      return
    }
    const target = event.target as HTMLElement | null
    const tag = target?.tagName ?? ''
    const isField = tag === 'INPUT' || tag === 'TEXTAREA'
    if (!isField) {
      return
    }
    keyboardOpen.value = true
    syncHtmlClass()
  }

  /**
   * Обработчик потери фокуса: даём клавиатуре закрыться и пересчитываем.
   *
   * @returns void
   */
  function onFocusOut(): void {
    window.setTimeout(() => {
      recalcKeyboard()
      syncHtmlClass()
    }, 120)
  }

  /**
   * Обработчик ресайза вьюпорта (открытие/закрытие клавиатуры).
   *
   * @returns void
   */
  function onViewportChange(): void {
    recalcKeyboard()
    syncHtmlClass()
  }

  let stopNavigate: (() => void) | null = null

  onMounted(() => {
    syncPath()
    try {
      stopNavigate = router.on('navigate', () => syncPath())
    } catch {
      stopNavigate = null
    }
    const viewport = window.visualViewport
    if (viewport) {
      viewport.addEventListener('resize', onViewportChange)
      viewport.addEventListener('scroll', onViewportChange)
    }
    window.addEventListener('resize', onViewportChange)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    recalcKeyboard()
    syncHtmlClass()
  })

  onBeforeUnmount(() => {
    try {
      stopNavigate?.()
    } catch {}
    stopNavigate = null
    const viewport = window.visualViewport
    if (viewport) {
      viewport.removeEventListener('resize', onViewportChange)
      viewport.removeEventListener('scroll', onViewportChange)
    }
    window.removeEventListener('resize', onViewportChange)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    document.documentElement.classList.remove('native-keyboard-open')
    document.documentElement.classList.remove('native-swipes')
  })

  return { dashboardHref, isActive, isActivePath, navLinkClass, total, navHidden, keyboardOpen, isBusiness, isStaff, showMap, showLove, showFlow, showDistricts, gridClass }
}
