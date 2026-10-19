import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { route } from '@/route'
import { useBellNotifications } from '@/composables/useBellNotifications'
import { useAppModulesStore } from '@/stores/appModules'
import { useStaffRole } from '@/composables/useStaffRole'

/**
 * Горячие клавиши десктопа: навигация, действия, поиск.
 *
 * Работают только с физической клавиатурой и вне полей ввода.
 * Включение хранится в localStorage, помощь открывается по `?`.
 * @example
 * const hotkeys = useAppHotkeys()
 * onMounted(() => hotkeys.init())
 */

export type AppHotkeyId =
  | 'go-profile'
  | 'go-map'
  | 'go-swipes'
  | 'go-flow'
  | 'go-chat'
  | 'go-settings'
  | 'new-pin'
  | 'open-bell'
  | 'focus-search'
  | 'global-people-search'
  | 'show-help'
  | 'swipe-pass'
  | 'swipe-like'

export interface AppHotkeyDef {
  id: AppHotkeyId
  keys: string[]
  title: string
  desc: string
}

export interface AppHotkeyGroup {
  id: string
  label: string
  items: AppHotkeyDef[]
}

/**
 * Глобальный поиск людей: доступен всегда, кроме чистого ULove —
 * там его видит только staff (админ/модератор).
 */
const GLOBAL_PEOPLE_SEARCH_HOTKEY: AppHotkeyDef = { id: 'global-people-search', keys: ['Ctrl+K'], title: 'Люди', desc: 'Глобальный поиск по людям' }

/**
 * Горячие клавиши чистого ULove-режима: только знакомства.
 *
 * Стрелки листают колоду (← пропустить, → лайк), навигация —
 * профиль, свайпы, чат и настройки. Карты, ленты и пинов здесь нет.
 */
export const ULOVE_HOTKEY_GROUPS: AppHotkeyGroup[] = [
  {
    id: 'swipes',
    label: 'Свайпы',
    items: [
      { id: 'swipe-pass', keys: ['←'], title: 'Пропустить', desc: 'Свайп влево в ленте' },
      { id: 'swipe-like', keys: ['→'], title: 'Лайк', desc: 'Свайп вправо в ленте' },
    ],
  },
  {
    id: 'nav',
    label: 'Переходы',
    items: [
      { id: 'go-profile', keys: ['P', 'Alt+1'], title: 'Профиль', desc: 'Открыть свой профиль' },
      { id: 'go-swipes', keys: ['L', 'Alt+2'], title: 'ULove', desc: 'Открыть знакомства' },
      { id: 'go-chat', keys: ['C', 'Alt+3'], title: 'Чат', desc: 'Открыть сообщения' },
      { id: 'go-settings', keys: ['S'], title: 'Настройки', desc: 'Открыть настройки' },
    ],
  },
  {
    id: 'actions',
    label: 'Действия',
    items: [
      { id: 'open-bell', keys: ['B'], title: 'Уведомления', desc: 'Открыть колокол' },
    ],
  },
  {
    id: 'search',
    label: 'Поиск',
    items: [{ id: 'show-help', keys: ['?'], title: 'Помощь', desc: 'Показать все горячие клавиши' }],
  },
]

/**
 * Описание всех горячих клавиш для секции настроек и диалога помощи.
 */
export const APP_HOTKEY_GROUPS: AppHotkeyGroup[] = [
  {
    id: 'nav',
    label: 'Переходы',
    items: [
      { id: 'go-profile', keys: ['P', 'Alt+1'], title: 'Профиль', desc: 'Открыть свой профиль' },
      { id: 'go-map', keys: ['M', 'Alt+2'], title: 'Карта', desc: 'Перейти на карту' },
      { id: 'go-swipes', keys: ['L', 'Alt+3'], title: 'ULove', desc: 'Открыть знакомства' },
      { id: 'go-flow', keys: ['F', 'Alt+4'], title: 'UFlow', desc: 'Открыть ленту' },
      { id: 'go-chat', keys: ['C', 'Alt+5'], title: 'Чат', desc: 'Открыть сообщения' },
      { id: 'go-settings', keys: ['S'], title: 'Настройки', desc: 'Открыть настройки' },
    ],
  },
  {
    id: 'actions',
    label: 'Действия',
    items: [
      { id: 'new-pin', keys: ['N'], title: 'Новый пин', desc: 'Создать пин на карте' },
      { id: 'open-bell', keys: ['B'], title: 'Уведомления', desc: 'Открыть колокол' },
    ],
  },
  {
    id: 'search',
    label: 'Поиск',
    items: [
      GLOBAL_PEOPLE_SEARCH_HOTKEY,
      { id: 'focus-search', keys: ['/'], title: 'Поиск', desc: 'Фокус на поиск на текущей странице' },
      { id: 'show-help', keys: ['?'], title: 'Помощь', desc: 'Показать все горячие клавиши' },
    ],
  },
]

const STORAGE_KEY = 'app.hotkeys.enabled'

const enabled = ref(true)
const showHelp = ref(false)
const ready = ref(false)
let inited = false

/**
 * Десктоп ли это: точный указатель без touch-экрана.
 * @returns true только для устройств с физической клавиатурой
 */
export function isDesktopKeyboard(): boolean {
  try {
    const fine = window.matchMedia('(pointer: fine)').matches
    const coarse = window.matchMedia('(pointer: coarse)').matches
    return fine && !coarse
  } catch {
    return false
  }
}

/**
 * Печатает ли пользователь сейчас в поле ввода.
 * @param target цель клавиатурного события
 * @returns true если фокус в input/textarea/select или contenteditable
 */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = (el.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  try {
    if (el.isContentEditable) return true
  } catch {}
  return false
}

/**
 * Находит видимое поле поиска на текущей странице.
 * @returns поле поиска или null
 */
function findSearchField(): HTMLElement | null {
  const selectors = [
    '[data-hotkeys-search]:not([disabled])',
    'input[placeholder*="Поиск"]:not([disabled])',
    'input[type="search"]:not([disabled])',
  ]
  for (const selector of selectors) {
    const fields = Array.from(document.querySelectorAll<HTMLElement>(selector))
    const visible = fields.find((field) => field.offsetParent !== null)
    if (visible) return visible
  }
  return null
}

/**
 * Открыть глобальный поиск людей (Ctrl+K).
 * Шлёт событие, которое слушает `useGlobalPeopleSearch`.
 */
export function openGlobalPeopleSearch(): void {
  try {
    window.dispatchEvent(new CustomEvent('people-search:open'))
  } catch {}
}

/**
 * Ставит фокус в поиск на текущей странице.
 * @returns true если поле найдено и сфокусировано
 */
export function focusSearchOnPage(): boolean {
  try {
    const field = findSearchField()
    if (!field) return false
    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field.focus({ preventScroll: true })
    return true
  } catch {
    return false
  }
}

/**
 * Текущий маршрут — карта?
 * @returns true если открыта страница карты
 */
function isMapRoute(): boolean {
  try {
    return route().current('map')
  } catch {
    return window.location.pathname.startsWith('/map')
  }
}

export function useAppHotkeys() {
  const bell = useBellNotifications()
  const { isModerator } = useStaffRole()
  const isDesktop = computed(() => {
    if (!ready.value) return false
    return isDesktopKeyboard()
  })

  /**
   * Чистый ULove-режим: карта и лента выключены — действуют
   * только знакомства (стрелки листают колоду, лишнего нет).
   */
  const uloveMode = computed(() => {
    try {
      const modules = useAppModulesStore()
      return modules.isEnabled('ulove') && !modules.isEnabled('upin') && !modules.isEnabled('uflow')
    } catch {
      return false
    }
  })

  /**
   * Набор подсказок под текущий режим. В чистом ULove глобальный
   * поиск людей показываем только staff.
   */
  const groups = computed(() => {
    if (!uloveMode.value) {
      return APP_HOTKEY_GROUPS
    }

    if (!isModerator.value) {
      return ULOVE_HOTKEY_GROUPS
    }

    return ULOVE_HOTKEY_GROUPS.map((group) =>
      group.id === 'search'
        ? { ...group, items: [GLOBAL_PEOPLE_SEARCH_HOTKEY, ...group.items] }
        : group,
    )
  })

  /**
   * Глобальный поиск людей в чистом ULove разрешён только staff.
   * @returns true если действие заблокировано режимом
   */
  function isUloveBlocked(id: AppHotkeyId): boolean {
    if (!uloveMode.value) {
      return false
    }

    if (isModerator.value && id === 'global-people-search') {
      return false
    }

    return ['go-map', 'go-flow', 'new-pin', 'focus-search', 'global-people-search'].includes(id)
  }

  /**
   * Выполнить действие горячей клавиши.
   * @param id идентификатор действия
   */
  async function runHotkey(id: AppHotkeyId): Promise<void> {
    if (isUloveBlocked(id)) {
      return
    }

    switch (id) {
      case 'go-profile':
        router.visit(route('dashboard'))
        break
      case 'go-map':
        router.visit(route('map'))
        break
      case 'go-swipes':
        router.visit(route('swipes'))
        break
      case 'go-flow':
        router.visit(route('flow'))
        break
      case 'go-chat':
        router.visit(route('chat'))
        break
      case 'go-settings':
        router.visit(route('profile.edit'))
        break
      case 'new-pin':
        openCreatePin()
        break
      case 'open-bell':
        bell.open()
        break
      case 'focus-search':
        focusSearchOnPage()
        break
      case 'global-people-search':
        openGlobalPeopleSearch()
        break
      case 'show-help':
        showHelp.value = true
        break
    }
  }

  /**
   * Открыть создание пина: на карте — диалогом, вне карты — переходом.
   */
  function openCreatePin(): void {
    if (isMapRoute()) {
      window.dispatchEvent(new CustomEvent('map:open-create'))
      return
    }
    const mapUrl = `${route('map')}?create=1`
    router.visit(mapUrl)
  }

  /**
   * Переключить помощь по клавишам.
   * @param next новое состояние или инверсия текущего
   */
  function setHelp(next?: boolean): void {
    const open = next ?? !showHelp.value
    showHelp.value = open
  }

  /**
   * Включить или выключить горячие клавиши с сохранением.
   * @param next новое состояние
   */
  function setEnabled(next: boolean): void {
    enabled.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {}
  }

  function readStored(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) !== '0'
    } catch {
      return true
    }
  }

  /**
   * Свайп стрелкой в ULove-режиме: событие слушает страница свайпов.
   * @param dir направление колоды
   */
  function emitSwipe(dir: 'like' | 'pass'): void {
    try {
      window.dispatchEvent(new CustomEvent('ulove:swipe', { detail: dir }))
    } catch {
    }
  }

  /**
   * Открыта ли лента свайпов (стрелки действуют только там).
   */
  function isSwipesRoute(): boolean {
    try {
      return route().current('swipes*')
    } catch {
      return window.location.pathname.startsWith('/swipes')
    }
  }

  function onKeydown(e: KeyboardEvent): void {
    if (!enabled.value) return
    if (!isDesktopKeyboard()) return

    const withCtrl = e.ctrlKey || e.metaKey
    const key = e.key ?? ''
    const code = (e as any).code ?? ''

    if (withCtrl && (key.toLowerCase() === 'k' || code === 'KeyK')) {
      if (isUloveBlocked('global-people-search')) {
        return
      }
      e.preventDefault()
      openGlobalPeopleSearch()
      return
    }

    if (e.altKey && !withCtrl) {
      const altTarget = uloveMode.value ? altDigitTargetUlove(key) : altDigitTarget(key)
      if (altTarget) {
        e.preventDefault()
        void runHotkey(altTarget)
        return
      }
    }
    if (e.altKey || withCtrl) return

    if (key === 'Escape') {
      if (showHelp.value) showHelp.value = false
      return
    }

    if (isTypingTarget(e.target)) return

    if (uloveMode.value && (code === 'ArrowLeft' || code === 'ArrowRight') && isSwipesRoute()) {
      e.preventDefault()
      emitSwipe(code === 'ArrowRight' ? 'like' : 'pass')
      return
    }

    if (key === '/' || key === '?') {
      if (uloveMode.value && key === '/') {
        return
      }
      e.preventDefault()
      const target: AppHotkeyId = e.shiftKey || key === '?' ? 'show-help' : 'focus-search'
      void runHotkey(target)
      return
    }

    const single = uloveMode.value ? singleKeyTargetUlove(code, key) : singleKeyTarget(code, key)
    if (single) {
      e.preventDefault()
      void runHotkey(single)
    }
  }

  /**
   * Alt+цифра навигации.
   * @param key нажатая клавиша
   * @returns действие или null
   */
  function altDigitTarget(key: string): AppHotkeyId | null {
    switch (key) {
      case '1': return 'go-profile'
      case '2': return 'go-map'
      case '3': return 'go-swipes'
      case '4': return 'go-flow'
      case '5': return 'go-chat'
      default: return null
    }
  }

  /**
   * Alt+цифра в ULove-режиме: только знакомства.
   * @param key нажатая клавиша
   * @returns действие или null
   */
  function altDigitTargetUlove(key: string): AppHotkeyId | null {
    switch (key) {
      case '1': return 'go-profile'
      case '2': return 'go-swipes'
      case '3': return 'go-chat'
      default: return null
    }
  }

  /**
   * Одиночная буквенная клавиша (по коду раскладконезависимо).
   * @param code физический код клавиши
   * @param key символ с учётом раскладки
   * @returns действие или null
   */
  function singleKeyTarget(code: string, key: string): AppHotkeyId | null {
    const latin = key.toLowerCase()
    if (code === 'KeyP' || latin === 'p') return 'go-profile'
    if (code === 'KeyM' || latin === 'm' || latin === 'ь') return 'go-map'
    if (code === 'KeyL' || latin === 'l' || latin === 'д') return 'go-swipes'
    if (code === 'KeyF' || latin === 'f' || latin === 'а') return 'go-flow'
    if (code === 'KeyC' || latin === 'c' || latin === 'с') return 'go-chat'
    if (code === 'KeyS' || latin === 's' || latin === 'ы') return 'go-settings'
    if (code === 'KeyN' || latin === 'n' || latin === 'т') return 'new-pin'
    if (code === 'KeyB' || latin === 'b' || latin === 'и') return 'open-bell'
    return null
  }

  /**
   * Одиночная клавиша в ULove-режиме: без карты, ленты и пинов.
   * @param code физический код клавиши
   * @param key символ с учётом раскладки
   * @returns действие или null
   */
  function singleKeyTargetUlove(code: string, key: string): AppHotkeyId | null {
    const latin = key.toLowerCase()
    if (code === 'KeyP' || latin === 'p') return 'go-profile'
    if (code === 'KeyL' || latin === 'l' || latin === 'д') return 'go-swipes'
    if (code === 'KeyC' || latin === 'c' || latin === 'с') return 'go-chat'
    if (code === 'KeyS' || latin === 's' || latin === 'ы') return 'go-settings'
    if (code === 'KeyB' || latin === 'b' || latin === 'и') return 'open-bell'
    return null
  }

  function init(): void {
    if (inited) return
    inited = true
    enabled.value = readStored()
    ready.value = true
    window.addEventListener('keydown', onKeydown)
  }

  onMounted(() => init())
  onBeforeUnmount(() => {
    try {
      window.removeEventListener('keydown', onKeydown)
    } catch {}
    inited = false
  })

  return { enabled, showHelp, isDesktop, groups, uloveMode, init, runHotkey, setHelp, setEnabled }
}
